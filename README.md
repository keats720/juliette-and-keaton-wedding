# Juliette & Keaton — Wedding

Static wedding website. Host on **GitHub Pages** with your own custom URL.

## Hosting on GitHub

1. Create a new repo (e.g. `wedding` or `juliette-keaton`).
2. Push this folder to the repo.
3. **Settings → Pages**: set source to **Deploy from a branch**, branch **main**, folder **/ (root)**.
4. After a few minutes the site will be at `https://<username>.github.io/<repo>/`.

## Custom URL

- In your domain registrar, add a **CNAME** record pointing to `\<username>.github.io`.
- In the repo: **Settings → Pages**, set **Custom domain** to your domain and save.
- Optional: tick **Enforce HTTPS**.

## Before you publish

- **Hero image**: Add your photo as `assets/hero.jpg` (or update the `src` in `index.html`).
- **RSVP**: In `index.html`, replace the RSVP button `href` with your Notion form URL.
- **Wedding year**: If needed, change `2026` in `index.html` (title, date text, and countdown script) and in the footer on each page.
- **Accommodation**: Add hotel block booking link/code on `accommodation.html` when you have it.
- **Dress code**: Update `dress-code.html` when you have the theme.

## Photos (Cloudflare R2)

Wedding photos live in a Cloudflare R2 bucket (free tier covers 10GB, no
egress fees) — never in this repo. The gallery page (`photos.html`) reads
`photos-manifest.json` (committed here) and loads images from R2.

One-time setup (needs `wrangler login` first):

```sh
npx wrangler r2 bucket create wedding-photos
npx wrangler r2 bucket dev-url enable wedding-photos   # prints the public https://pub-….r2.dev URL
npx wrangler r2 bucket cors set wedding-photos --file scripts/r2-cors.json
```

Then resize + upload (re-run any time the photographer delivers more folders —
already-uploaded files are skipped):

```sh
scripts/prepare-photos.sh "<path to photo folder>" wedding-photos "https://pub-eb6629a1914b47b5b811ea91951bfe84.r2.dev"
```

Commit the updated `photos-manifest.json` and push. `photo-staging/` is
gitignored scratch output — safe to delete once uploaded.

## Pages

| Page           | Path               |
|----------------|--------------------|
| Home           | `index.html`       |
| Information    | `information.html` |
| Schedule       | `schedule.html`    |
| Accommodation  | `accommodation.html` |
| Dress Code     | `dress-code.html`  |

No build step — open `index.html` in a browser to preview locally.
