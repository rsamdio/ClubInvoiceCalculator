Dependency changes

- Replaced CDN dependencies with local files in `newdev/vendor/`:
  - `xlsx.full.min.js` 0.18.5
  - `papaparse.min.js` 5.4.1
  - `jspdf.umd.min.js` 2.5.1
  - `jspdf.plugin.autotable.min.js` 3.5.29
- Tailwind remains via CDN to preserve exact UI/UX class behavior (no UI changes). Consider future local build to remove CDN.

Performance improvements

- Minified assets generated:
  - `styles.min.css` from `styles.css`
  - `app.min.js` from `app.js`
  - `modules/security.min.js` from `modules/security.js`
  - `modules/calculations.min.js` from `modules/calculations.js`
  - `pdf-worker.min.js` from `pdf-worker.js`
- Switched to local vendor files for reduced DNS/TLS and improved reliability.
- Web Worker now loads local jsPDF and autoTable.
- Kept existing preconnect/preload hints; updated to local where applicable.

Testing outcomes

- Feature parity maintained: calculator logic untouched (`modules/*`), `app.js` behavior preserved, PDF generation via worker intact.
- UI/UX unchanged; `styles.min.css` is minified version of original CSS.
- CSV/XLSX parsing continues via the same libraries (now local).

Notes

- Firebase is still loaded via official CDN ESM imports; unchanged.
- Consider further optimization: build Tailwind locally, code-split `app.js` if necessary, and inline critical CSS selectively.
