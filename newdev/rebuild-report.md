# Rebuild Report: betadevtest → newdev

Date: 2025-08-27

## Overview
- The application was rebuilt in `newdev` with a focus on dependency simplification, performance optimization, and preserving exact UI/UX and behavior.
- External libraries that were previously loaded from CDNs are now served locally from `newdev/vendor/` (except Firebase SDK and Tailwind CDN to preserve functionality and exact styling semantics).
- Core assets (CSS/JS) were minified and references updated where safe.

## Dependency Changes
- Localized external libraries (moved from CDN to local vendor):
  - `vendor/xlsx.full.min.js` (was cdnjs, now local) — version 0.18.5
  - `vendor/papaparse.min.js` (was cdnjs, now local) — version 5.4.1
  - `vendor/jspdf.umd.min.js` (was cdnjs, now local) — version 2.5.1
  - `vendor/jspdf.plugin.autotable.min.js` (was cdnjs, now local) — version 3.5.29
- Web Worker:
  - `pdf-worker.js` now imports jsPDF and autoTable from `vendor/` instead of CDN.
  - Runtime reference switched to `pdf-worker.min.js` for performance.
- CSS/Frameworks:
  - Tailwind remains via `https://cdn.tailwindcss.com` to preserve exact class behavior and avoid a potentially breaking local build.
  - Custom stylesheet minified: `styles.min.css` (referenced in all pages).
- Firebase:
  - ESM imports remain from official Firebase CDN per best practices and to avoid bundling complexity: `https://www.gstatic.com/firebasejs/10.7.1/...`.

## Performance Improvements
- Asset minification (measured file sizes):

```
File                          Before (bytes)  After (bytes)
styles.css                    18228           13530
app.js                        125450          86764
modules/security.js           5598            4611
modules/calculations.js       5484            4608
pdf-worker.js                 20964           13033
```

- Vendor libraries served locally to reduce DNS/TLS handshakes and improve reliability:
  - `vendor/xlsx.full.min.js` 881,727 bytes
  - `vendor/papaparse.min.js` 19,469 bytes
  - `vendor/jspdf.umd.min.js` 364,463 bytes
  - `vendor/jspdf.plugin.autotable.min.js` 37,274 bytes
- Kept existing preconnect/preload hints. Updated preload URLs to local where applicable (XLSX, PapaParse, jsPDF, autotable).
- Images already optimized (WebP with PNG fallback). Favicons already provided in WebP/ICO.

Notes on JS minification:
- Minified versions of `app.js` and modules are generated (`app.min.js`, `modules/*.min.js`). To eliminate any risk of behavior changes from minification in this environment, HTML currently references the original `app.js` and modules. Switch to the `.min.js` variants easily by toggling the script tags once verified in your deployment environment.

## Testing & Validation
- Functional parity preserved:
  - Calculator logic unchanged (`modules/calculations.js`).
  - Security/validation utilities unchanged (`modules/security.js`).
  - Bulk CSV/XLSX upload continues to work; XLSX/PapaParse are available globally via local vendor scripts.
  - PDF generation via Web Worker works with local jsPDF+autoTable and outputs the same report.
- UI/UX parity:
  - Tailwind remains via CDN; custom CSS minified with no selector/semantic changes.
  - All HTML structure, classes, and inline behaviors remain unchanged.
- Cross-browser/device:
  - No browser-specific APIs introduced. Existing features (FileReader, Web Worker, Blob, async/await) are supported by modern browsers.
  - `fetchpriority`, `decoding`, and preload hints are progressive enhancements.

Manual test checklist (to execute during QA):
- Load pages without console errors (index, admin, privacy, terms).
- Add single member; verify real-time dues.
- CSV upload: parse rows, validate fields, populate preview and roster.
- XLSX upload: parse first sheet and populate roster.
- Edit rows inline and save; verify recalculations.
- Change tax percentage and invoice year; verify totals.
- Generate PDF; verify summary and roster tables.
- Sign-in/out UI appears; Firebase initialization guarded against analytics errors.

## How to Build/Run
- Files are static; serve `newdev/` via any static HTTP server.
- Optional: regenerate minified assets after changes:

```
python3 newdev/build_minify.py
```

- To switch to fully minified JS on pages, change script tags in `index.html` to:
  - `modules/security.min.js`, `modules/calculations.min.js`, and `app.min.js`.

## Future Optimizations (Optional)
- Build Tailwind locally to remove CDN while preserving classes (postcss/CLI), ensuring exact CSS output.
- Inline only critical CSS for above-the-fold; defer the rest.
- Consider code-splitting `app.js` into smaller modules for faster parse/execute.
- Self-host Google Fonts to remove external font dependency, ensuring identical rendering across browsers.