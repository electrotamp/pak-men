import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIni,
  stringifyIni,
  valueNeedsQuoting,
  getString,
  getInt,
  getBool,
  IniBuilder,
} from '../src/shared/ini.ts';

test('valueNeedsQuoting matches the firmware predicate', () => {
  assert.equal(valueNeedsQuoting(''), false);
  assert.equal(valueNeedsQuoting('plain'), false);
  assert.equal(valueNeedsQuoting('has spaces inside'), false);
  assert.equal(valueNeedsQuoting('a=b'), false); // '=' does NOT trigger quoting
  assert.equal(valueNeedsQuoting(' leading'), true);
  assert.equal(valueNeedsQuoting('trailing '), true);
  assert.equal(valueNeedsQuoting('semi;colon'), true);
  assert.equal(valueNeedsQuoting('hash#tag'), true);
  assert.equal(valueNeedsQuoting('quote"here'), true);
  assert.equal(valueNeedsQuoting("apos'here"), true);
});

test('writer: global keys first, blank line before each section', () => {
  const out = stringifyIni([
    { name: '', pairs: [['presents_as', '2']] },
    { name: 'custom_boot', pairs: [['cic_type', '6102']] },
    { name: 'presentation', pairs: [['image_view_grid', '3']] },
  ]);
  assert.equal(
    out,
    'presents_as = 2\n' +
      '\n[custom_boot]\n' +
      'cic_type = 6102\n' +
      '\n[presentation]\n' +
      'image_view_grid = 3\n',
  );
});

test('writer: quotes and escapes only when required', () => {
  const out = stringifyIni([
    {
      name: 'meta',
      pairs: [
        ['title', 'Super Mario 64'],
        ['description', 'Great game; a classic'],
        ['weird', 'back\\slash and "quote"'],
      ],
    },
  ]);
  assert.equal(
    out,
    '[meta]\n' +
      'title = Super Mario 64\n' +
      'description = "Great game; a classic"\n' +
      'weird = "back\\\\slash and \\"quote\\""\n',
  );
});

test('favorites.ini shape round-trips', () => {
  const b = new IniBuilder();
  b.setString('favorite', '0_primary_path', 'sd:/All n64/F-Zero X (USA).n64');
  b.setString('favorite', '0_secondary_path', '');
  b.setInt('favorite', '0_type', 1);
  b.setString('favorite', '0_game_code', 'CFZE');
  const text = b.toString();
  assert.equal(
    text,
    '[favorite]\n' +
      '0_primary_path = sd:/All n64/F-Zero X (USA).n64\n' +
      '0_secondary_path = \n' +
      '0_type = 1\n' +
      '0_game_code = CFZE\n',
  );
  const doc = parseIni(text);
  assert.equal(getString(doc, 'favorite', '0_primary_path'), 'sd:/All n64/F-Zero X (USA).n64');
  assert.equal(getString(doc, 'favorite', '0_secondary_path'), '');
  assert.equal(getInt(doc, 'favorite', '0_type', -1), 1);
  assert.equal(getString(doc, 'favorite', '0_game_code'), 'CFZE');
});

test('reader: comments, quoted values, sectionless keys, last-wins', () => {
  const doc = parseIni(
    '; a comment\n' +
      '# another\n' +
      'schema_revision = 1\n' +
      'default_directory = "/All n64"\n' +
      '\n' +
      '[menu]\n' +
      'pal60 = false\n' +
      'pal60 = true\n' +
      'note = value ; trailing comment stripped\n',
  );
  assert.equal(getInt(doc, '', 'schema_revision', 0), 1);
  assert.equal(getString(doc, '', 'default_directory'), '/All n64');
  assert.equal(getBool(doc, 'menu', 'pal60', false), true);
  assert.equal(getString(doc, 'menu', 'note'), 'value');
});

test('reader: unquoted escape sequences are kept literally', () => {
  // firmware only unescapes \" \' \\ inside quotes; \n stays as backslash+n
  const doc = parseIni('[meta]\ndescription = "line one\\nline two"\n');
  assert.equal(getString(doc, 'meta', 'description'), 'line one\\nline two');
});

test('getInt is strict like strtol with *end == 0', () => {
  const doc = parseIni('[menu]\na = 12\nb = 12abc\nc = \nd = -3\n');
  assert.equal(getInt(doc, 'menu', 'a', 99), 12);
  assert.equal(getInt(doc, 'menu', 'b', 99), 99);
  assert.equal(getInt(doc, 'menu', 'c', 99), 99);
  assert.equal(getInt(doc, 'menu', 'd', 99), -3);
});
