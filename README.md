# The 3rd Space — website

Static site (HTML, CSS, vanilla JS). No framework and no build step on Vercel.

## 1. Generate the assets (once)

The photos, illustrations and floor-plan data are produced from the Figma export:

```
pip install pillow
python build_assets.py
```

This reads `../figma_export_27-4940.zip` and writes `assets/` and `js/scene-data.js`.
Commit those generated files; Vercel serves them as-is.

## 2. Preview locally

Open `index.html` directly, or run a small server so clean URLs behave like production:

```
python -m http.server 8000
```

then visit http://localhost:8000

## 3. Deploy

1. Push this `website` folder to a GitHub repo (it can be the repo root, or a subfolder).
2. In Vercel: **Add New → Project**, import the repo.
3. Framework preset: **Other**. Leave build command and output directory empty.
   If the site lives in a subfolder of the repo, set **Root Directory** to that folder.
4. Deploy. `vercel.json` gives clean URLs (`/gallery`, `/contact`) and caching headers.

## Pages

- `index.html` — homepage
- `gallery.html` — 3 photo grids with arrows to page between them
- `contact.html` — contact form (opens the visitor's email app addressed to hello@thirdspace.in)
- `404.html` — not-found page

## Animations

- Floor plan (`js/scene.js`): scroll-driven. Row 1 walks in; row 2 walks through the door into the room and four people sit at the table.
- This week, Instagram, "See the vibe", "Make your night extra": continuous marquees (`.marquee` in `js/main.js`).
  `data-dir="left"` moves right-to-left, `data-dir="right"` moves left-to-right, `data-speed` is pixels per second.
- "Whether it's a...": hover (or tap) an item to bring its photo to the front.
- All motion is switched off for visitors with "reduce motion" turned on.

## Editing content

- Swap a photo: replace the file in `assets/img/` with one of the same name (JPG, ~1600px wide).
- Gallery photos: edit the `<figure>` tags in `gallery.html`.
- Phone number, email, Instagram link: search for `XXXXX`, `hello@thirdspace.in` and `instagram.com` in the HTML files.
