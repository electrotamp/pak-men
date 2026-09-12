/**
 * TemplateThumb — a static, scaled-down render of a template's start page, shown
 * on each card in the Template picker (shell/TemplatePicker.tsx).
 *
 * It draws the real elements through <ElementView> (same component the canvas
 * uses), so the preview is true to the result. No interaction, no chrome —
 * `pointer-events` are off and the whole thing is clipped to the frame.
 *
 * Template `image` elements have no host file to resolve, so they render empty;
 * the first-batch templates avoid images for exactly this reason.
 */

import { FRAMEBUFFER, startPage, type MenuLayout } from '../../shared/menu-schema.ts';
import { ElementView, boxOverflows } from './ElementView.tsx';

export function TemplateThumb({ layout, width = 224 }: { layout: MenuLayout; width?: number }) {
  const page = startPage(layout);
  const k = width / FRAMEBUFFER.w;
  const height = Math.round(FRAMEBUFFER.h * k);

  return (
    <div className="mb-tpl-thumb" style={{ width, height }}>
      <div
        className="mb-tpl-thumb-board"
        style={{
          width: FRAMEBUFFER.w,
          height: FRAMEBUFFER.h,
          transform: `scale(${k})`,
          transformOrigin: '0 0',
          background: page.background ?? '#0C122C',
        }}
      >
        {page.elements.map((e) => {
          const rot = ('rotation' in e ? e.rotation : 0) ?? 0;
          const clip = !boxOverflows('box' in e ? e.box : undefined);
          return (
            <div
              key={e.id}
              style={{
                position: 'absolute',
                left: e.rect[0],
                top: e.rect[1],
                width: e.rect[2],
                height: e.rect[3],
                transform: rot ? `rotate(${rot}deg)` : undefined,
              }}
            >
              <div style={{ position: 'absolute', inset: 0, overflow: clip ? 'hidden' : 'visible' }}>
                <ElementView el={e} px={(n) => n} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
