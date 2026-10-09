# Quietmark

A Next.js app for adding small, repeated watermarks to images. Image processing runs entirely in the browser; files are never uploaded to the app server.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Run `npm run build` to generate the static site in `out/`, then serve that folder from any static host.

## Deploy to GitHub Pages

In the repository's **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**. The workflow in `.github/workflows/deploy-pages.yml` builds and deploys on every push to `main`, including merges. For this repository, the site URL will be [https://christopherferreira9.github.io/quietmark/](https://christopherferreira9.github.io/quietmark/). The workflow sets the `/quietmark` base path automatically.

## Notes

- Upload multiple JPG, PNG, WebP, AVIF, GIF, or BMP images supported by the browser.
- Choose diagonal or horizontal repeats, then adjust text size, visibility, and spacing.
- Switch between light and dark mode in the header. The app remembers your choice and otherwise follows your system theme.
- The preview uses a scaled image; generation uses the original pixel dimensions.
- JPEG, PNG, and WebP inputs retain their format. Other supported inputs export as PNG. Animated GIFs export their first frame.
- Download individual files or one ZIP containing all successful results.
- A watermark provides context and may discourage casual reuse, but it can be removed or cropped; it is not proof of where a leak came from.
