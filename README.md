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

## Pages

| Page           | Path               |
|----------------|--------------------|
| Home           | `index.html`       |
| Information    | `information.html` |
| Schedule       | `schedule.html`    |
| Accommodation  | `accommodation.html` |
| Dress Code     | `dress-code.html`  |

No build step — open `index.html` in a browser to preview locally.
