# Credits

PAK-MEN's Menu Builder is a design tool for menus that run on **N64ever**, a
fork of **N64FlashcartMenu**. None of the firmware or console-side rendering
this app targets is original work, and neither are several of the assets and
tools it bundles. This file credits all of it.

## The menu this tool designs for

**N64FlashcartMenu**
Copyright (C) Robin Jones (NetworkFusion), Mateusz Faderewski (Polprzewodnikowy),
and the N64FlashcartMenu contributors.
https://github.com/Polprzewodnikowy/N64FlashcartMenu
Licensed under the GNU Affero General Public License v3.0.

**N64ever** — the fork this menu builder specifically targets (its Favorites
Grid, popup UI, and `menu.json` format)
Modified by Bjerreman and contributors, based on N64FlashcartMenu V0.3.2.
https://github.com/bjerreman/N64FlashcartMenu-N64ever
No separate copyright is claimed over these modifications; see
`source/NOTICE` and `source/LICENSE.md` at the repo root for the full text.

## Bundled with this app

**libdragon** — the N64 SDK the menu firmware itself is built on.
https://github.com/DragonMinded/libdragon

**gopher64** — the N64 emulator bundled for the "Test Menu" preview (boots
your design without a real console or SD card).
https://github.com/gopher64/gopher64

**PixelMplus** — bitmap-style TrueType font, used for the canvas' built-in
console font preview.
Copyright (C) 2013 itouhiro; Copyright (C) 2002-2013 M+ FONTS PROJECT.
Licensed under the M+ FONT LICENSE.
http://itouhiro.hatenablog.com/entry/20130602/font

**Firple** — TrueType font, used for the canvas' display-font preview.
Copyright (c) 2021 negset; based on Fira Code (The Fira Code Project
Authors) and IBM Plex (IBM Corp).
Licensed under the SIL Open Font License 1.1.
https://github.com/negset/Firple

**Box-art / metadata** — the bundled cover-art library follows the format
documented by the N64 Flashcart Menu Metadata project.
https://github.com/n64-tools/n64-flashcart-menu-metadata

**Electron, Chromium, Node.js, React, and this app's other npm
dependencies** ship their own licenses alongside the packaged app
(`LICENSE.electron.txt`, `LICENSES.chromium.html`) — see those files for
full text and attribution.

## This tool

The Menu Builder application itself (everything under
`source/tools/menu-builder`) was built for this project; see the repository's
own commit history for its authorship.
