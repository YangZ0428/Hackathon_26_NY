# Brand assets — CliMap NYC

Standalone folder. Nothing here is wired into `frontend/` or `NewUI/` — the
files are just sitting here for whoever picks them up.

## Files

| File | Use |
| --- | --- |
| `climap-hero.png` (1200×400) / `climap-hero@2x.png` (2400×800) | site heading / og:image |
| `climap-logo-1024.png` | master icon |
| `climap-logo-{512,256,180,128,64,32}.png` | app icon, apple-touch-icon (180), favicon |

## Palette

Taken from the app's own `src/styles.css`, so these drop in without
introducing a second visual language:

- text / deck `--foreground` `#111E16`
- "NYC" and the main cable `--primary` `#1A6936`
- subtitle `--muted-foreground` `#5C6A60`
- type is **Manrope**, already loaded in `__root.tsx`

One colour is new: the blue `#24689B` on the towers and suspender cables.
There is no blue in the token set, so it was derived at the same lightness and
chroma as the existing green (oklch L .50 / C .105) — the two read as one
family rather than two systems.

## Notes

- The suspender cables run the full span and pass *behind* the frosted panel on
  purpose. The glass effect only exists if there is something behind it to blur.
- The icon is legible down to ~56px. Below that (favicon at 32px) the two
  gothic arches close up — a tower-only mark would be better at that size.
- The repo currently spells the name **Climap NYC** (README, page titles).
  These assets use **CliMap NYC**. Worth settling one way before launch.

## Regenerating

```bash
cd brand/src && python3 climap.py
```

Then screenshot with Chrome headless — hero at `--window-size=1200,400
--force-device-scale-factor=2`, icon at `1024,1024` scale 1, both with
`--headless=new --default-background-color=00000000`. Manrope is pulled from
Google Fonts at render time, so rendering needs network.
