# 🎨 Chroma — Palette Extractor & Contrast Checker

A designer's color toolkit: pull a palette from any image, generate color harmonies, and check WCAG accessibility contrast — all running locally in the browser, no backend, no sign-up.

**[Live Demo](#)** — replace this with your GitHub Pages link after deploying (steps below)

![Chroma preview](https://via.placeholder.com/900x500/1A1B20/5EEAD4?text=Chroma+%E2%80%94+Palette+%26+Contrast+Tool)

## Features

- 🖼️ **Extract palettes from images** — drag and drop or upload any photo; Chroma samples pixels on a canvas and quantizes them into the dominant colors (3–8 swatches, adjustable)
- 🌈 **Harmony generator** — one click for complementary, analogous, triadic, or monochrome color schemes, built from real color theory (HSL rotation)
- 🔒 **Lock swatches** — keep the colors you like while regenerating the rest
- ♿ **WCAG contrast checker** — pick any foreground/background pair and instantly see the contrast ratio plus AA/AAA pass-fail badges for normal and large text
- 📋 **One-click copy** — click any swatch to copy its hex code
- 📤 **Export formats** — CSS variables, JSON, or a Tailwind config snippet, ready to paste into a project
- 💾 **Gallery** — save palettes locally and revisit them anytime, all via `localStorage`

## Tech Stack

- Vanilla JavaScript (no framework, no build step)
- Canvas API for image pixel sampling and color quantization
- WCAG 2.1 relative luminance / contrast ratio formulas implemented from spec
- `localStorage` for the saved-palette gallery
- Google Fonts: [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), [Inter](https://fonts.google.com/specimen/Inter), [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono)

## Getting Started

```bash
git clone https://github.com/YOUR-USERNAME/chroma.git
cd chroma
open index.html   # or just double-click the file
```

No install, no dependencies — it's plain HTML/CSS/JS.

## Deploying to GitHub Pages (free hosting)

1. Push this repo to GitHub.
2. Go to **Settings → Pages** in your repo.
3. Under **Source**, select the `main` branch and `/ (root)` folder, then **Save**.
4. Your app goes live at `https://YOUR-USERNAME.github.io/chroma/` within a minute or two.
5. Update the "Live Demo" link at the top of this README.

## How the extraction works

Images are downscaled and drawn to a hidden canvas, then every pixel's RGB value is bucketed into a coarse color grid (quantization). The most frequent buckets become the palette, averaged back to real RGB so the swatches stay accurate — all done client-side, so the image never leaves your browser.

## How the contrast checker works

Contrast ratio follows the WCAG 2.1 formula: relative luminance is computed for both colors using the standard sRGB coefficients, then `(lighter + 0.05) / (darker + 0.05)` gives the ratio. A ratio of 4.5:1 or higher passes AA for normal text; 7:1 passes AAA.

## Project Structure

```
chroma/
├── index.html      # markup for extract / contrast / gallery views
├── styles.css       # theme, layout, responsive rules
├── app.js           # color math, extraction, harmonies, contrast, gallery
└── README.md
```

## Possible Extensions

- Export palettes as an Adobe Swatch Exchange (.ase) file
- Batch-check contrast across an entire palette against a fixed background
- Color-blindness simulation preview
- Share a palette via a shareable URL (encode colors in the query string)

## License

MIT — free to use, modify, and share.

---

Built as a portfolio project for UI/UX and front-end work.
