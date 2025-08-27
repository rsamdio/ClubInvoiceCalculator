# Club Invoice Calculator - newdev

This is the rebuilt app using Vite for bundling and optimized loading. UI/UX and features remain identical to the original.

## Run (dev)

```bash
cd newdev
npm install
npm run dev
```

## Build

```bash
npm run build
# Output in dist/
```

## Structure

- `index.html`, `admin.html`: pages
- `public/`: static assets (`styles.css`, images, worker, redirects)
- `src/app.js`: original app code (bundled/minified)
- `src/vendor/`: non-UI modules (`security.js`, `calculations.js`)
- `src/firebase-config.js`: Firebase config (imported by pages)

## Notes

- External libraries (xlsx, PapaParse, jsPDF) are still from CDN to preserve exact behavior. Can be self-hosted later if needed.
- PDF worker referenced as `/pdf-worker.js` from public.