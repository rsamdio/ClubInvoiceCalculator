# AGENTS.md — Rotaract Club Invoice Calculator

Guidance for AI agents and developers working in this repository.

## Project summary

Static web app for **Rotaract South Asia MDIO (RSAMDIO)** that calculates club membership invoices, manages member rosters, syncs data to Firebase, and generates PDF reports.

| Item | Value |
|------|-------|
| Production URL | https://dues.rsamdio.org/ |
| Firebase project | `clubinvoicecalculator` |
| Stack | Vanilla JS, HTML, CSS — **no npm / bundler** |
| Backend | Firebase Auth (Google) + Firestore |
| UI | Tailwind CSS (CDN) + `styles.css` |
| Hosting | Firebase Hosting (`_redirects` handles Netlify → primary domain) |

## Repository layout

```
ClubInvoiceCalculator/
├── index.html              # Main calculator (~2900 lines; UI + inline wiring + PDF trigger)
├── admin.html              # Admin dashboard (~2800 lines; self-contained inline JS)
├── app.js                  # Core logic (~3500 lines): members, Firebase, bulk upload
├── modules/
│   ├── calculations.js     # Pure dues math + formatting (window.DuesCalculator, DuesFormatter)
│   └── security.js         # Validation + sanitization (window.SecurityUtils, FormValidator)
├── pdf-worker.js           # Web Worker PDF generation (jsPDF + autoTable)
├── firebase-config.js      # Firebase config (ESM export)
├── styles.css              # Custom CSS (buttons, cards, dropdowns, tables)
├── build_minify.py         # Generates *.min.css and *.min.js
├── firestore.indexes.json  # Firestore composite indexes for admin queries
├── privacy.html / terms.html
├── vendor/                 # Local libs (jspdf; xlsx/papaparse/autotable referenced but may be missing)
└── _redirects              # Netlify redirect to dues.rsamdio.org
```

## Architecture

- **No modules in app code** except Firebase bootstrap (inline `<script type="module">` in HTML).
- **Global namespace:** `window.appFunctions`, `window.firebase*`, `window.allMemberRows`, `window.currentUser`.
- **Split initialization:** Firebase auth is wired in `index.html` inline script, not only in `app.js`.
- **PDF generation:** Offloaded to `pdf-worker.js` via `new Worker('pdf-worker.js')`.

```
index.html → app.js + modules/* + pdf-worker.js → Firebase Auth + Firestore
admin.html → inline JS → Firestore (admin gate via admins/{uid})
```

## Data models

### Member (`users/{uid}.memberRoster[]`)

```javascript
{
  id: string,              // e.g. "member-{timestamp}"
  name: string,
  joinDate: "YYYY-MM-DD",
  leaveDate: string,         // optional, ""
  memberType: "Community-Based" | "University-Based"
}
```

Live roster state: `window.allMemberRows` — array of `<tr>` elements with `dataset.*` fields.

### Settings (`users/{uid}.settings`)

```javascript
{
  taxPercentage: number,   // default 18
  currencyRate: number,      // default 96
  invoiceYear: string
}
```

### Invoice summary (`users/{uid}.invoiceSummaries[]`)

Logged when a PDF is generated. Capped at **10 most recent** entries (sorted by timestamp, newest first).

### Firestore collections

| Collection | Doc ID | Purpose |
|------------|--------|---------|
| `users` | Firebase UID | Roster, settings, invoice summaries, profile metadata |
| `admins` | Firebase UID | Admin access — **doc existence = admin** |

Security rules (see `README.md`): users read/write own docs; admins can read/write any user doc.

## Dues calculation rules

Core function: `calculateIndividualDue(joinDate, clubBase, invoiceYear, leaveDate)`.

**Implemented in two places — keep in sync:**
- `modules/calculations.js` → `window.DuesCalculator.calculateIndividualDue`
- `app.js` → local `calculateIndividualDue()` (used at runtime)

| Club base | Annual dues (USD) |
|-----------|-------------------|
| Community-Based | $8 |
| University-Based | $5 |

Invoice year = January 1 of the selected year.

| Join timing | Result |
|-------------|--------|
| Previous year (`joinYear === invoiceYear - 1`) | Full year + prorated months from join (day > 1 → start next month) |
| Current invoice year | $0 (dues start next year) |
| Before previous year | Full year dues (unless left before invoice date → $0) |
| Leave date before invoice date | $0 or prorated-only depending on join year |

Tax and local currency are applied in `updateTotal()` using `taxPercentage` and `currencyRate`.

## Key flows

1. **Bootstrap:** Load scripts (defer) → Firebase ESM sets `window.firebase*` → `initializeApp()` → auth via `initializeFirebaseAuthDirectly()` in `index.html`.
2. **Add member:** `addMember()` → DOM row + `allMemberRows` → `updateTotal()` → optional debounced cloud save.
3. **Bulk import:** CSV/XLSX → lazy-load PapaParse/XLSX → `validateMemberData()` → preview → `addBulkMembers()`.
4. **Cloud sync:** `getCurrentData()` → `saveUserData()` (2s debounce) / `loadUserData()` with local-vs-cloud conflict dialog.
5. **PDF:** Inline in `index.html` → worker message → `logInvoiceSummary()` on success.
6. **Admin:** Sign in → check `admins/{uid}` → search users by email, view roster/invoices, promote admins.

## Public API (`window.appFunctions`)

Defined at end of `app.js` (~line 3429). Includes UI helpers and Firebase functions:

- UI: `addMember`, `updateTotal`, `recalculateAllDues`, pagination, bulk upload, `initializeApp`, etc.
- Firebase: `initializeFirebaseAuth`, `handleLogin`, `handleLogout`, `saveUserData`, `loadUserData`, `logUserActivity`, `logInvoiceSummary`, `setupManualSave`, `handleManualSave`, `cleanup`

HTML inline scripts depend on this object — do not rename or remove exports without updating `index.html`.

## Where to change what

| Task | Files |
|------|-------|
| Dues / proration rules | `modules/calculations.js` **and** `app.js` `calculateIndividualDue()` |
| Input validation | `modules/security.js` **and** `app.js` `FormValidator` / `SecurityUtils` |
| Member table / forms | `index.html` + `app.js` row rendering |
| PDF layout | `pdf-worker.js` |
| Auth / save / load | `app.js` + `index.html` auth wiring |
| Admin features | `admin.html` inline script |
| Custom styling | `styles.css` + Tailwind classes in HTML |
| Firebase project | `firebase-config.js` |
| Firestore indexes | `firestore.indexes.json` |
| SEO / meta | `index.html`, `sitemap.xml`, `robots.txt` |

## Build and deploy

No npm. After editing JS or CSS:

```bash
python3 build_minify.py
```

Generates: `styles.min.css`, `app.min.js`, `modules/*.min.js`, `pdf-worker.min.js`.

Production HTML should reference `.min.js` / `styles.min.css` (see `README.md`). Current `index.html` mixes minified and unminified scripts — verify before deploy.

Deploy:

```bash
firebase deploy
```

## Coding conventions for this repo

1. **Minimize scope.** This is a focused static app — avoid introducing npm, bundlers, or frameworks unless explicitly requested.
2. **Match existing patterns.** Global `window.*` exports, DOM `dataset` for row state, Tailwind utility classes, inline HTML wiring.
3. **Sync duplicates.** Changes to calculation or validation logic must update both `modules/` and `app.js` until duplication is removed.
4. **Sanitize user input.** Use `SecurityUtils.sanitizeHTML` / `sanitizeText` when rendering user-provided strings.
5. **Preserve `window.allMemberRows`.** Any roster mutation must update this array and call `updateTotal()` + `updatePagination()`.
6. **Do not commit secrets.** `firebase-config.js` contains public Firebase keys (expected for client apps) — do not add service account keys or private credentials.
7. **No inline imports.** Keep `<script src>` at file top/bottom per existing HTML structure.
8. **Comments:** Only for non-obvious business logic (especially dues proration edge cases).

## Known gotchas

1. **`app.js` duplicates `modules/`** — `SecurityUtils`, `FormValidator`, and `calculateIndividualDue` exist in both places. Modules load first; app.js copies are what often runs.
2. **Large inline scripts** in `index.html` and `admin.html` — many event handlers live outside `app.js`.
3. **Missing vendor files** — repo may only contain `vendor/jspdf.umd.min.js`. Bulk upload and PDF need `xlsx.full.min.js`, `papaparse.min.js`, `jspdf.plugin.autotable.min.js`.
4. **Tailwind via CDN** — classes are JIT-compiled at runtime; no local Tailwind build.
5. **`window.appFunctions` assigned twice** in `app.js` — second assignment (~line 3429) is the complete export with Firebase helpers.
6. **Auth init split** — `initializeFirebaseAuth()` exists in `app.js` but primary auth flow is `initializeFirebaseAuthDirectly()` in `index.html`.

## Internal utilities (`app.js`)

| Utility | Purpose |
|---------|---------|
| `DOMCache` | Cached `getElementById` |
| `EventManager` | Event delegation for dynamic roster rows |
| `PerformanceMonitor` | Timing metrics |
| `ErrorHandler` | Centralized error handling |
| `CircuitBreaker` | Firebase call resilience |
| `DataCache` / `documentExistsCache` | Firestore read caching |

## Testing checklist

Manual QA (no automated test suite):

- [ ] Load `index.html` and `admin.html` without console errors
- [ ] Add / edit / remove single member; totals update
- [ ] CSV and XLSX bulk upload with preview
- [ ] Change tax %, currency rate, invoice year; totals recalculate
- [ ] Google sign-in; save and reload cloud data
- [ ] Generate PDF; verify summary logged for authenticated users
- [ ] Admin: sign in as admin, search user, view roster and invoice history

## Do not

- Add npm/package.json unless the user explicitly requests a build toolchain migration.
- Force-push to `main` / `master`.
- Create git commits unless the user asks.
- Edit unrelated files when making a focused fix.
- Remove CSP meta tags without understanding downstream script dependencies.
