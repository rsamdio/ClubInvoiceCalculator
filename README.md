[![Netlify Status](https://api.netlify.com/api/v1/badges/cd4a7109-c2f6-4cf0-ad8d-48c5e68e98ad/deploy-status)](https://app.netlify.com/projects/rotaractdues/deploys)

# Rotaract Club Invoice Calculator

Browser-based estimator for Rotaract club membership dues invoices (Rotary International), built for **Rotaract South Asia MDIO (RSAMDIO)**.

**Live site:** [https://dues.rsamdio.org/](https://dues.rsamdio.org/)

Figures are estimates only. Official invoices come from Rotary (My Rotary). Dues are calculated as of **January 1** of the selected invoice year.

## Stack

| Item | Detail |
|------|--------|
| App | Vanilla HTML, CSS, JavaScript (no npm app toolchain) |
| UI | Tailwind CSS (CDN) + `styles.css` / `styles.min.css` |
| Auth / data | Firebase Auth (Google + Anonymous for live `/learn` join) + Cloud Firestore + Realtime Database (`asia-southeast1`) |
| Firebase project | `clubinvoicecalculator` |
| PDF | Web Worker (`pdf-worker.js`) with jsPDF + autoTable |
| Admin | `admin.html` (access gated by `admins/{uid}` docs; Workshop Hosts tab) |
| Learn | `/learn/` worksheet + `/learn/host.html` live-session console |

## Features

- **Member roster:** add, edit, remove; join/leave dates; club base (Community-Based **$8** / University-Based **$5**)
- **Live dues math:** annual + prorated breakdowns, tax %, USD→local rate
- **Bulk import:** Excel/CSV upload, or public Google Sheets link (Anyone with the link can view)
- **PDF report:** **Generate Detailed Report** downloads a full estimate with roster breakdown
- **Cloud backup (optional):** Google sign-in; **manual Save to Cloud only** (nothing autosaves). Button shows Unsaved / Saving / Saved while signed in
- **Sign-in conflict:** if cloud data exists, choose current session or load from cloud
- **First-visit help:** instructions modal matching the current UI flow
- **Rotaract Club Invoice Basics:** eight-stage worksheet at [`/learn/`](https://dues.rsamdio.org/learn/) (self-paced on-device, or live session via a 6-digit host code). Same $8 / $5 January 1 model as the calculator.

## Repository layout

```
ClubInvoiceCalculator/
├── index.html              # Main calculator
├── admin.html              # Admin dashboard + Workshop Hosts
├── app.js / app.min.js     # Core app logic
├── learn/                  # Rotaract Club Invoice Basics worksheet + host console
├── faq.html / how-ri-dues-work.html
├── llms.txt / sitemap.xml / robots.txt
├── modules/
│   ├── calculations.js     # Dues math (also mirrored in app.js)
│   └── security.js         # Validation / sanitization (also mirrored in app.js)
├── pdf-worker.js           # PDF generation worker
├── firebase-config.js      # Client Firebase config (includes RTDB URL)
├── firebase.json           # Firestore + RTDB + Functions
├── database.rules.json     # Live-session RTDB rules
├── firestore.rules         # users, admins, workshopHosts
├── styles.css              # Custom styles
├── build_minify.py         # Generates *.min.css / *.min.js
├── firestore.indexes.json  # Composite indexes for admin queries
├── vendor/                 # Local libs (jspdf, xlsx, papaparse, autotable)
├── privacy.html / terms.html
└── _redirects              # Netlify → dues.rsamdio.org
```

## Quick start

1. **Clone**
   ```bash
   git clone https://github.com/rsamdio/ClubInvoiceCalculator.git
   cd ClubInvoiceCalculator
   ```

2. **Serve locally over HTTP**  
   Do not rely on `file://`. Use any static server so modules, workers, and Sheets import work:
   ```bash
   python3 -m http.server 8080
   ```
   Then open `http://localhost:8080`.

3. **Firebase (if using your own project)**  
   Update `firebase-config.js` (keep `databaseURL` on the asia-southeast1 RTDB), enable Google Authentication, Anonymous Authentication (live `/learn` join), Firestore, and Realtime Database. Deploy rules from this repo:

   ```bash
   firebase deploy --only database,firestore:rules,functions --project clubinvoicecalculator
   ```
   *Note: The frontend is hosted on Netlify, so you do not need to deploy `hosting` via Firebase CLI.*

4. **After editing JS or CSS**
   ```bash
   python3 build_minify.py
   ```
   Regenerates `styles.min.css`, `app.min.js`, `modules/*.min.js`, and `pdf-worker.min.js`.

   **Note:** `index.html` may mix minified and unminified script tags (for example `styles.min.css` + `app.js`). Confirm script/stylesheet references before a production deploy.

## Usage

### Add members
1. Fill **Add New Member** (name, club base, join date, optional leave date).
2. Click **Add Member**. Totals update immediately.

### Bulk import
1. Download the CSV template, or make a copy of the Google Sheets template.
2. Upload `.xlsx` / `.xls` / `.csv`, **or** paste a public Sheets URL.
3. Review the preview, then confirm. Rows are **appended** to the current roster (not replaced).

### Invoice summary
1. Set invoice year, tax %, and currency rate at the top.
2. Review USD and local totals (including Annual + Prorated and tax lines).
3. Click **Generate Detailed Report** for the PDF.

### Cloud data
- **Sign in** from the top bar (optional for calculating).
- Click **Save to Cloud** to back up. Changes are not written until you save.
- On sign-in with existing cloud data, pick **current session** or **load from cloud**.
- **Reset Roster** clears the session roster after confirmation (does not by itself update the cloud).

### Rotaract Club Invoice Basics (`/learn/`)
1. Open [Rotaract Club Invoice Basics](https://dues.rsamdio.org/learn/).
2. **Learn at my own pace** keeps answers on the device. No Google account.
3. **Join a live session** uses the 6-digit code from a host. Email is for follow-up only, not a login.
4. Hosts sign in at [`/learn/host.html`](https://dues.rsamdio.org/learn/host.html). Calculator admins can host; other hosts are invited from **Admin → Workshop Hosts**.
5. The host console is two steps: all of *your* sessions, then that session’s classroom board. Other hosts cannot see your rooms.

## Data model

### Member (`users/{uid}.memberRoster[]`)
```javascript
{
  id: string,          // e.g. "member-{timestamp}"
  name: string,
  joinDate: "YYYY-MM-DD",
  leaveDate: string,   // optional, ""
  memberType: "Community-Based" | "University-Based"
}
```

### Settings (`users/{uid}.settings`)
```javascript
{
  taxPercentage: number,  // default 18
  currencyRate: number,   // default 96
  invoiceYear: string
}
```

### Invoice summaries (`users/{uid}.invoiceSummaries[]`)
Logged when a PDF is generated for a signed-in user. Kept to the **10 most recent** entries.

### Collections
| Collection | Doc ID | Purpose |
|------------|--------|---------|
| `users` | Firebase UID | Roster, settings, invoice summaries, profile fields |
| `admins` | Firebase UID | Admin access (`admin.html`); **document existence = admin** |
| `workshopHosts` | Firebase UID | Learn-session hosts (admins can host without this doc) |

## Firestore rules

Canonical rules live in [`firestore.rules`](firestore.rules) and are deployed with:

```bash
firebase deploy --only firestore:rules --project clubinvoicecalculator
```

Do **not** deploy Pulse/RSAQA rules to this Firebase project. Bootstrap the first admin by creating `admins/{uid}` in the Console.

### Model summary (matches `firestore.rules`)

```javascript
// users/{uid}: owner create/read/update; admin read/write/delete
// admins/{uid}: self-read for gate; admin create/update; delete others only (not self)
// workshopHosts/{uid}: self-get or admin; list/write admin only
```

Older README snippet is superseded by the committed `firestore.rules` file.

## Realtime Database rules

Canonical rules live in [`database.rules.json`](database.rules.json):

```bash
firebase deploy --only database --project clubinvoicecalculator
```

Live rooms live at `rooms/{6-digit-code}`. Each host only lists rooms under `hostRooms/{theirUid}`. Participants join with Anonymous Auth and can write only their own participant node while the room is `open`.

## Dues rules (summary)

| Club base | Annual dues (USD) |
|-----------|-------------------|
| Community-Based | $8 |
| University-Based | $5 |

Core function: `calculateIndividualDue(joinDate, clubBase, invoiceYear, leaveDate)`.

Implemented in both `modules/calculations.js` and `app.js`. Keep them in sync when changing proration logic.

High-level behavior:
- Invoice year = January 1 of the selected year
- Join on 1 January of the invoice year → full-year Annual Dues on that invoice
- Join after 1 January of the invoice year → $0 on that invoice (Pro Rata Dues start the following year)
- Join on 1 January of the prior year → full-year Annual Dues only on the next invoice (no 12-month Pro Rata Dues)
- Mid-year leave after January 1 does not reduce the January 1 snapshot invoice

## Troubleshooting

**Firebase / cloud data**
- Confirm Google Auth and Firestore are enabled
- Confirm you are signed in
- Remember: roster edits are local until **Save to Cloud**

**Google Sheets import**
- Share as Anyone with the link can view
- Use a `docs.google.com/spreadsheets/...` URL
- Or download CSV and use file upload

**Scripts / PDF / bulk upload**
- Serve over HTTP, not `file://`
- Ensure `vendor/` contains jspdf, autotable, xlsx, and papaparse
- Hard-refresh after changing JS/CSS; run `python3 build_minify.py` if you rely on `.min` assets

**Learn / live sessions**
- Enable Anonymous Authentication for join-with-code
- Hosts must be a calculator admin or listed under Workshop Hosts
- Deploy RTDB rules (`database.rules.json`) and keep `databaseURL` on asia-southeast1
- `/learn/host.html` is not a public page (noindex)

## Support

Questions or feature requests: [rsamdio@gmail.com](mailto:rsamdio@gmail.com)

## License / terms

There is no separate open-source `LICENSE` file in this repository. Site use is covered by [terms.html](terms.html) and [privacy.html](privacy.html).
