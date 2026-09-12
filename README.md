<div align="center">

# 🎮 PAK-MEN — the N64 Flash Cart Menu Builder

**Design your N64 flash cart's menu on your PC — drag, drop, preview, export. No code, no controller-fumbling on a console.**

[![License: MIT](https://img.shields.io/badge/Builder%20license-MIT-3fb950?style=flat-square)](#-license)
[![Menu license: AGPL--3.0](https://img.shields.io/badge/Menu%20license-AGPL--3.0-blue?style=flat-square)](#-license)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-6f42c1?style=flat-square)](#-quick-start)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron-9feaf9?style=flat-square)](#-what-is-this)

</div>

---

## Table of contents

- [What is this?](#-what-is-this)
- [Quick start](#-quick-start)
- [Designing a menu](#-designing-a-menu)
  - [The canvas](#the-canvas)
  - [Pages](#pages)
  - [Elements](#elements)
  - [Shapes & box styling](#shapes--box-styling)
  - [Text & fonts](#text--fonts)
  - [Button actions](#button-actions)
  - [Templates](#templates)
  - [Controls (button remapping)](#controls-button-remapping)
  - [System pop-up theming](#system-pop-up-theming)
  - [Overscan compensation & safe-zone guide](#overscan-compensation--safe-zone-guide)
  - [CRT filter preview](#crt-filter-preview)
  - [App skin](#app-skin)
- [What your menu can do on real hardware](#-what-your-menu-can-do-on-real-hardware)
  - [Game sources & the games list/grid](#game-sources--the-games-listgrid)
  - [Box art & the built-in game database](#box-art--the-built-in-game-database)
  - [The File Browser element](#the-file-browser-element)
  - [Saves](#saves)
  - [Screensaver](#screensaver)
  - [64DD disc linking](#64dd-disc-linking)
  - [ROM boot on power-on](#rom-boot-on-power-on)
  - [Dynamic text tokens](#dynamic-text-tokens)
  - [Full settings reference](#full-settings-reference)
- [Test Menu — preview without hardware](#-test-menu--preview-without-hardware)
- [Import / Export](#-import--export)
- [Auto-updates](#-auto-updates)
- [Testers wanted](#-testers-wanted)
- [Credits](#-credits)
- [License](#-license)

---

## 🧭 What is this?

**PAK-MEN** is two things working together:

1. **A menu** — the on-console experience that boots when you turn on your N64 with a flash
   cart (SC64 / ED64 / 64drive). It shows your games as cover art, remembers favourites and
   recently-played, and replaces the usual bare file list with something that feels like a
   real console UI.
2. **A Menu Builder** — this app. A desktop tool where you design that menu visually: drag
   elements onto a 640×480 canvas, pick from ready-made templates or build your own layout
   from scratch, preview it in a bundled emulator, and export it straight to your SD card.

You don't write any code and you don't need to touch a text editor. Every screen your console
shows — the home screen, your games grid, the settings page, everything — is just a
`menu.json` file this app writes for you, one click at a time.

---

## 🚀 Quick start

1. **Download** the latest release and unzip it anywhere — it's a plain folder, no installer.
   Run `PAK-MEN.exe` inside it.
2. Pick a **template** from the dropdown at the top-left (or start from **Grand Tour**, the
   default — it's a full tour of every feature).
3. Click **Import** to pull in your existing SD card's favourites/history, or just start
   designing — drag elements from the left rail onto the canvas, click **Test Menu** any time
   to preview it in the bundled emulator.
4. When you're happy, click **Export**, point it at your SD card (or a folder to copy over
   later), and boot your console.

> [!TIP]
> **Nothing you do here can brick your console.** Exporting only ever writes to the `menu/`
> folder (plus the bundled firmware ROM at the SD card root) — it never touches your ROMs,
> saves, or anything else on the card.

---

## 🎨 Designing a menu

### The canvas

Every screen is laid out on a 640×480 canvas — the console's actual resolution, so what you
see is exactly what boots. You can:

- **Drag, resize, and rotate** any element by its handles.
- **Multi-select** (marquee-drag or Ctrl+click) and transform several elements together —
  a group resize/move scales every selected element's position, size, and font size in
  proportion, like Photoshop's Free Transform.
- **Snap to a grid** (1/2/4/8/16 px, toggleable) while dragging.
- **Undo / redo** every change (Ctrl+Z / Ctrl+Shift+Z) — including template switches, page
  duplication, and settings changes.
- **Copy / paste** elements (Ctrl+C / Ctrl+V), including across pages.
- **Free placement** by holding Alt (bypasses snap for one drag).

### Pages

A menu is an ordered set of **pages** — up to 16 of them, shown as tabs across the top of the
canvas. Each page is just a title, a background, an optional bottom hint-bar line, and a flat
list of elements (up to 40 per page — the console pre-allocates a fixed slot for each one, so
these caps are hard limits, not app restrictions).

- Exactly **one page is the boot screen** — toggle "This is the screen the console boots to"
  in the page panel.
- **Duplicate a page** from its tab (⧉) — deep-copies every element and the background as a
  new tab, ready to tweak.
- **Backgrounds** can be a flat colour or a full-screen wallpaper image, which you can
  position and resize independently of the rest of the page (drag its own handles, or use
  "Fill screen" / "Original size").
- **Per-page controller remap** — a page can override the global button map (e.g. a page that
  uses L/R for something other than turning pages).

### Elements

Nine element types, added from the left rail. Any element can sit inside a **shaped, styled
box** (see below), be rotated, and be freely positioned.

| Element | What it is |
|---|---|
| 🎮 **Game List** | Your games, as a list or a grid. Source it from every game on the card, a **named favourites collection** (you can have several — "Zelda", "Racing", however you want to organise favourites, not just one flat list), or your recently-played history. Grid tiles can show name labels (above, below, or over the art) and wrap or marquee-scroll long names. |
| 🖼️ **Box Art** | The cover of whichever game is currently highlighted elsewhere on the page — the classic "big preview" panel next to a list. |
| ℹ️ **Info Panel** | A labelled block of the highlighted game's details — release date, developer, region, whatever five labels you choose. |
| 🔤 **Text** | A static label or heading — or a **live clock**, if you give it a `strftime`-style format instead of fixed text. |
| 🖌️ **Panel** | A filled or outlined box with no content of its own — a background card, a divider, a frame around other elements. |
| 🧩 **Image** | Any PNG from your PC, placed and scaled however you like — logos, decorations, custom art. |
| 🔘 **Button** | Runs an action when pressed — see [Button actions](#button-actions) below. Can carry a glyph (a button-icon character) alongside its label. |
| ⚙️ **Setting** | A placeable on/off row wired directly to a real console setting (background music, rumble, sort order, and 7 others) — press A on the console to flip it, saved immediately. |
| 📂 **File Browser** | A full SD-card file manager dropped straight into your layout: navigate folders, launch ROMs/disks/emulator ROMs, open the image/text/music viewers, and — if you turn on "manage" — delete, rename, and move files, right from the console. |

`Text` and `Panel` are secretly the same element (a box that may or may not hold text) —
start either one and switch freely; the app keeps whichever fields make sense.

### Shapes & box styling

Any element's background box can be one of **7 shapes** — rectangle, circle, ellipse,
triangle, diamond, pentagon, hexagon, octagon — each with:

- **Fill** and **border** colour (either can be fully transparent).
- **Border alignment** — inside, outside, or centred on the shape's edge.
- **Corner rounding**, per-corner if you want asymmetric rounding (rectangles only).

Circles and regular polygons (diamond/pentagon/hexagon/octagon) lock to a 1:1 aspect ratio
when you resize them, so they never come out squashed.

### Text & fonts

- The console's **built-in UI font**, or any of **22 bundled display fonts** (a mix of
  pixel-art, retro-game-styled, and clean faces) — what you see in the canvas is pixel-exact
  to what the console renders, calibrated against real hardware.
- Font size is a free number, with a **"crisp" vs "soft" hint**: bitmap fonts render sharp
  only at their native size (12px built-in / 16px display) and whole multiples of it — the app
  tells you when you've landed on a sharp size and when you're between them.
- **Rotation** (any angle, with a "keep upright" override so rotated boxes can still hold
  screen-horizontal text), **letter spacing**, and **line height** are all adjustable per
  element.
- Text can be **left/center/right** aligned and **top/middle/bottom** valigned within its box,
  with independent padding on all four sides, and wraps or clips to its box like a normal text
  frame.

### Button actions

A Button (or Setting, or a Game List row) can run one of these:

| Action | What it does |
|---|---|
| **Go to page…** | Jumps to another page in your menu. |
| **Back** | Returns to wherever you came from. |
| **Open built-in screen…** | Opens one of 8 console-native screens: Settings, Files, History, Credits (the console's own about screen), Controller Pak manager, Real-time clock, Flashcart info, or System (N64) info. |
| **Launch selected game** | Boots whichever game is currently highlighted in a Game List / grid on that page. |
| **Favourite / un-favourite game…** | Adds or removes the highlighted game from a named favourites collection (or asks which one, if you have several). |
| **Toggle a setting…** | Flips one of the 10 remappable settings on/off. |
| **Force a setting on / off…** | Sets one of those settings to a specific state, rather than toggling it. |
| **Sort games A–Z** | Re-sorts the current game list alphabetically. |
| **Start screensaver** | Manually triggers the idle screensaver. |
| **Nothing** | A no-op — useful for a purely decorative button-shaped element. |

### Templates

A one-click starting layout, applied via the picker at the top of the toolbar (this replaces
your current design — undoable if you change your mind). All six styled themes below share
the same five-screen structure (home / library / grid / favourites / settings) and differ only
in cosmetics — palette, shapes, fonts, and which real box art/logos they decorate with.

| Template | What it looks like |
|---|---|
| 🏆 **Grand Tour** *(default)* | Every feature this app has, used more than once: a control-scheme explainer page, a favourites how-to, and a themed favourite-collection shelf per genre (Zelda, Mario, Racing, Party, Shooters). The best starting point if you want to see everything. |
| ⬜ **Blank** | One empty page. Start from nothing. |
| ➖ **Minimal** | Hairlines, one accent colour, and a wall of covers. |
| 🖼️ **Gallery** | A framed hang of box art on warm gold. |
| 🛰️ **Command Deck** | Sci-fi HUD — hexes, brackets, a scanned cartridge. |
| 🗡️ **Hyrule** | Parchment, gold, and *the Ocarina of Time*. |
| 🍄 **Mushroom Kingdom** | Brick, sky, a coin count, and *Super Mario 64*. |
| 🕹️ **Arcade Cabinet** | Marquee, bezel, and an attract-mode screen. |

### Controls (button remapping)

Every physical input — A, B, L, R, Z, Start, the four C-buttons, the D-pad, and the analog
stick's four directions — can be remapped to a menu action, either **globally** or as a
**per-page override**. The panel warns you about conflicts (two controls doing the same
discrete thing) and about essential actions (select, back, at least one direction) that have
become unreachable.

### System pop-up theming

The console's own dialogs — the file-browser action menu, yes/no prompts, the on-screen
keyboard, and the copy-progress bar — can be recoloured (background, border, text, highlight,
and the progress bar's track/fill) independently of your page designs. Leave any colour unset
to keep the console's built-in default.

### Overscan compensation & safe-zone guide

Real CRTs (and some upscalers) crop a slice off every edge of the picture. **Overscan
compensation** is a single dial (0–30%) that shrinks your *entire* menu uniformly toward
screen centre for displays that crop harder than average — it never touches any element's
authored size or position, just how the whole frame is scaled at display time (in both the
canvas preview and on real hardware). Turn on the **safe-zone guide** to see a dashed advisory
box showing the region a typical CRT keeps visible, so you can judge whether compensation is
even needed for your setup.

### CRT filter preview

A stack of five checkable filters that simulate a CRT display in the canvas only (a design
aid, not something that ships to the console): **scanlines**, **aperture grille**, **shadow
mask**, **bloom/blur**, and **tube vignette**. Combine any of them.

### App skin

The Builder's own interface (not your menu!) comes in two looks — **Flat** and **Bubbly** —
purely a matter of taste while you work.

---

## 🕹️ What your menu can do on real hardware

Everything above is *how you design it*; this section is *what actually runs on your
console*.

### Game sources & the games list/grid

Point a Game List element at **every game on the card**, a **named favourites collection**
(you can keep several separate shelves of favourites, not just one list), or your
**recently-played history**. Display it as a scrolling list or a grid of covers, with
configurable tile size, square or letterboxed art, and optional name labels.

### Box art & the built-in game database

- **767 game-code art directories baked directly into the console ROM** — no SD card art
  needed for covered games. If your cart's region isn't covered, it automatically falls back
  to another region's art (e.g. a PAL/JP game shows US art) rather than nothing.
- **445 games' worth of built-in text** — title, developer, release date, and a back-of-box
  description — looked up instantly by the game's own code, no internet required.
- **Special editions** are recognised by filename even when they reuse another game's product
  code (e.g. *Ocarina of Time: Master Quest*, *Smash Remix* get their own name/date/description
  and art).
- Uncovered games show a **realistic label-removed cartridge** (or 64DD disk) placeholder
  instead of a generic "no art" box.

### The File Browser element

A real file manager, not just a ROM launcher: browse any folder on the SD card, launch ROMs,
64DD disks, or emulator ROMs, open bundled image/text/music viewers — and, if you enable
**manage** mode, delete, rename, and move files directly from the console, with an on-screen
keyboard for typing names.

Emulator ROMs already on the card are launched the same way as native N64 ROMs — just browse
to them and press A. Nothing needs configuring in the Menu Builder for this to work; the
console recognises these by file extension:

| System | Extensions |
|---|---|
| NES | `.nes` |
| SNES | `.sfc`, `.smc` |
| Game Boy | `.gb` |
| Game Boy Color | `.gbc` |
| SEGA 8-bit (Master System / Game Gear / SG-1000) | `.sms`, `.gg`, `.sg` |
| Fairchild Channel F | `.chf` |

> [!NOTE]
> **To do:** there's no dedicated "Emulator" element yet — this all works today through the
> generic File Browser element above. A purpose-built element (its own icon/branding per
> system, a filtered "emulators only" view, etc.) is a planned future addition.

### Saves

Choose whether game saves live in a dedicated `saves` folder or alongside their ROMs, and
whether the save folder and individual save files are visible in the file browser.

### Screensaver

An animated cover-art marquee kicks in after an idle timeout (configurable, 30s–1hr), which
you can restrict to favourites only. It's also the live animated backdrop behind the console's
built-in Credits screen.

### 64DD disc linking

Expansion 64DD discs (like the *F-Zero X Expansion Kit*) get manually linked to their base
cartridge, per region, so launching them boots the right combination. Launching an unlinked
disc from the file browser offers to link it on the spot.

### ROM boot on power-on

Optionally boot straight into a chosen game on power-on, after a cancellable countdown (hold
Start during the countdown to go to the menu instead). Entirely userland — no firmware
autoboot flag is touched.

### Dynamic text tokens

Any Text element can embed live values that update automatically: `{fw_version}`,
`{menu_version}`, `{menu_base}`, `{libdragon}`, `{cart}`, `{fav_count}`, `{history_count}`,
`{date}`, and `{time}` — handy for a status line or a stylised "N64ever build 42" footer
without hardcoding anything.

### Full settings reference

Every one of these is exposed in the app's Settings panel and also placeable individually as
a **Setting** element (10 of them can be toggled by a console button too — see [Button
actions](#button-actions)).

<details>
<summary><b>ROM library</b></summary>

| Setting | What it does |
|---|---|
| ROM folder | SD folder the menu scans for games and the file browser opens to. Leave as `/` to auto-detect `sd:/ROMS/`, falling back to the card root. |
| 64DD disc folder | Folder the "link disc" picker starts in. |
| Honor per-game override files | Turns on custom per-game art/metadata (set automatically when your project has any). |
| Let me choose the ROM folder on first boot | Shows a folder picker right after a fresh flash, instead of auto-detecting. |

</details>

<details>
<summary><b>Games grid</b></summary>

| Setting | What it does |
|---|---|
| Square tiles | Letterboxes art into square tiles instead of native aspect. |
| Large tiles | Bigger covers, roughly one fewer row on screen. |
| Always sort grid A-Z | Keeps the grid alphabetized at all times. |
| Use legacy font (Firple) | Swaps the grid's font for the original Firple typeface. |
| Grid / Inspect popup / Load screen image | Which box-art angle (front, 3D box, cart, etc.) each of those three views prefers. |
| Default box-art region | Which region's art to prefer when more than one is available. |

</details>

<details>
<summary><b>Saves</b></summary>

| Setting | What it does |
|---|---|
| Put saves in a "saves" folder | Keeps saves separate from ROMs instead of alongside them. |
| Show the saves folder | Makes the saves folder visible in the file browser. |
| Show save files | Makes individual save files visible in the file browser. |

</details>

<details>
<summary><b>File browser</b></summary>

| Setting | What it does |
|---|---|
| Show protected / filtered entries | Un-hides files the menu normally filters out. |
| Show cheat files | Shows `.cht`/`.cheats`/etc. files. |
| Show ROM configuration files | Shows per-ROM `.ini`/config files. |
| Show file sizes | Adds a size column to file listings. |

</details>

<details>
<summary><b>Video</b></summary>

| Setting | What it does |
|---|---|
| PAL60 | Runs a PAL console at 60 Hz (shows a revert countdown on real hardware). |
| Force progressive scan (240p) | For displays that struggle with interlaced video. |

</details>

<details>
<summary><b>Audio</b></summary>

| Setting | What it does |
|---|---|
| Menu sound effects | Cursor/confirm/cancel sounds in the menu UI. |
| Background music | Music while browsing the menu. |

</details>

<details>
<summary><b>Screensaver</b></summary>

| Setting | What it does |
|---|---|
| Screensaver | On/off — the animated cover-art marquee. |
| Screensaver: favorites only | Restricts the marquee to favourited games. |
| Screensaver idle timeout | Seconds of inactivity before it kicks in (30–3600). |

</details>

<details>
<summary><b>Start-up & boot</b></summary>

| Setting | What it does |
|---|---|
| Show boot splash | Shows a splash screen before the menu loads. |
| Use custom splash image | Uses your own PNG instead of the default splash (set automatically when you add one). |
| Fast reboot ROM on reset button | Reboots straight into the last-played ROM on a hardware reset. |
| ROM boot on power-on | Shows a chosen ROM with a countdown at every power-on. |
| ROM boot: directory / filename / countdown | Which ROM to boot, and how long the cancellable countdown lasts (1–15s). |

</details>

---

## 🧪 Test Menu — preview without hardware

Click **Test Menu** to boot your current design in a bundled N64 emulator — no SD card, no
real console, no firmware rebuild. It exports your design to a throwaway disk image on the
fly and launches straight into it. A **4 MB** toggle previews how your layout behaves on a
stock console without an Expansion Pak (some designs — especially ones with a lot of box art
resident at once — need the extra RAM; this catches that before you're testing on real
hardware).

---

## 📤 Import / Export

- **Export** writes everything the console needs — `menu.json`, `config.ini`,
  `favorites.ini`, per-game overrides, resized art, and the bundled firmware ROM — either
  straight to your SD card or to a folder to copy over later. It shows you a plan first (what's
  new, what's changing, what's untouched) and never deletes files it doesn't own.
- **Import** reads an existing SD card's `menu/` folder back into the app — your favourites,
  history, and any per-game overrides come with it — so you can start editing a card you
  already have set up.

---

## 🔄 Auto-updates

The app checks for new versions and can download and apply them in place — no manual
reinstall, no console window, just a small progress popup and a restart. Click **Check for
updates** in the toolbar any time, or let it check automatically on launch.

---

## 🧑‍🔬 Testers wanted

All hardware testing so far has been done on an **SC64**. The menu firmware also targets the
**ED64** and **64drive**, but without one on hand there's no way to confirm it actually boots
and behaves correctly on those carts. If you own one and are willing to flash a test build and
report back, please get in touch — this is the biggest gap in confidence before calling
compatibility solid across all three.

---

## 🙏 Credits

This app designs menus for **N64ever**, a fork of **N64FlashcartMenu**, and bundles several
other open-source projects and assets. Full attribution: **[CREDITS.md](CREDITS.md)**.

---

## 📄 License

The **Menu Builder app** (this repository) is licensed under **MIT**.

The **menu firmware** it designs for (N64ever / N64FlashcartMenu) is separately licensed
under the **GNU Affero General Public License v3.0** — see `source/LICENSE.md` and
`source/NOTICE` at the repository root.
