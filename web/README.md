# DragonFlow website

The public landing page and privacy policy for the DragonFlow Android app, hosted on
Cloudflare Pages.

Plain static HTML and CSS — **no build step, no dependencies, no framework**. What is in this
folder is exactly what gets served.

```
web/
├── index.html      # Landing page
├── privacy.html    # Privacy policy (required for Google OAuth verification & Play Store)
├── 404.html        # Not-found page (Cloudflare Pages serves this automatically)
├── styles.css      # All styling; palette mirrors src/styles/theme.ts
├── main.js         # Only script on the site — keeps the footer year current
├── _headers        # Cloudflare Pages: security headers + cache policy
├── robots.txt
├── sitemap.xml
└── assets/         # App icon at web sizes, favicon, Open Graph card
```

## Local preview

```bash
cd web && python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works. There is nothing to compile.

## Deploying to Cloudflare Pages

One-time setup in the Cloudflare dashboard:

1. **Workers & Pages → Create → Pages → Connect to Git**, then pick `eyalpeleg/DragonFlow`.
2. Configure the build:

   | Setting | Value |
   | --- | --- |
   | Project name | `dragonflow` |
   | Production branch | `main` |
   | Framework preset | **None** |
   | Build command | *(leave empty)* |
   | Build output directory | `web` |
   | Root directory | *(leave empty)* |

   The empty build command is deliberate — Pages just uploads `web/` as-is.
3. **Save and Deploy.** The site goes live at `https://dragonflow.pages.dev`.

After that, every push to `main` redeploys production automatically, and pushes to other
branches get their own preview URL.

### Custom domain

Under **Pages → dragonflow → Custom domains**, add the hostname (e.g. `dragonflow.plgsw.com`)
and follow the DNS prompt. If the zone is already on Cloudflare the record is created for you.

If you use a custom domain, update the absolute URLs so canonical links, the sitemap and the
Open Graph card point at the real host:

```bash
cd web
grep -rl 'dragonflow.pages.dev' . | xargs sed -i '' 's|dragonflow\.pages\.dev|dragonflow.plgsw.com|g'   # macOS
```

(On Linux, drop the `''` after `-i`.)

## Keeping the page honest

A few spots go stale if the app moves on — check them when you cut a release:

- **Version badge** — `index.html` shows `Android · Version 1.0.9`. Bump it to match
  `app.json` → `expo.version`.
- **Download button** — points at `github.com/eyalpeleg/DragonFlow/releases/latest`. That link
  404s until the first GitHub Release exists; `./release.sh` produces the APK to attach to one.
- **Feature list** — mirrors the *Shipped* table in `docs/design/features.md`.
- **Privacy policy** — sections 2, 3 and 5 describe what is stored, the Drive scope, and the
  Android permissions. If any of those change in the app, change them here in the same PR.
  The "Last updated" date at the top of `privacy.html` is maintained by hand.

## Security headers

`_headers` applies a strict Content-Security-Policy (`default-src 'none'`, no inline scripts or
styles, no third-party origins at all). If you ever add an embed, an analytics snippet or a web
font, the CSP has to be widened in the same change or the browser will silently block it.
