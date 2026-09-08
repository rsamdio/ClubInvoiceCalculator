#!/usr/bin/env node
/**
 * submit-indexnow.mjs — Automated URL submission to IndexNow for dues.rsamdio.org
 *
 * IndexNow simultaneously notifies participating search engines:
 * Microsoft Bing, Yandex, Seznam.cz, Naver, Yep, etc.
 *
 * Usage:
 *   node scripts/submit-indexnow.mjs               # Submits all canonical sitemap URLs
 *   node scripts/submit-indexnow.mjs --dry-run     # Inspect URLs without sending
 *   node scripts/submit-indexnow.mjs --force       # Bypass remote key check
 *   node scripts/submit-indexnow.mjs --url=<url>   # Submit a single URL
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");

const HOST = "dues.rsamdio.org";
const SITE_BASE = `https://${HOST}`;
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const SITEMAP_URL = `${SITE_BASE}/sitemap.xml`;
const BATCH_SIZE = 10000;
const FALLBACK_KEY = "fc66e32136887908af4a8222ec18b665";

// Excluded / non-indexable paths (per robots.txt and netlify headers)
const EXCLUDED_PATTERNS = [
  /\/admin(\.html|\/|$)/i,
  /\/learn\/host(\.html|\/|$)/i,
];

function getIndexNowKey() {
  try {
    const files = readdirSync(ROOT_DIR);
    // Find any hex txt file (minimum 8, maximum 128 characters)
    const keyFile = files.find(
      (f) => /^[a-f0-9]{8,128}\.txt$/i.test(f) && !["robots.txt", "llms.txt"].includes(f)
    );
    if (keyFile) {
      const content = readFileSync(resolve(ROOT_DIR, keyFile), "utf-8").trim();
      if (content) {
        return { key: content, filename: keyFile };
      }
    }
  } catch (err) {
    console.warn("[IndexNow] Could not read key file from root:", err.message);
  }
  return { key: FALLBACK_KEY, filename: `${FALLBACK_KEY}.txt` };
}

const { key: KEY, filename: KEY_FILENAME } = getIndexNowKey();
const KEY_LOCATION = `${SITE_BASE}/${KEY_FILENAME}`;

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isForce = args.includes("--force");
const isBuild = args.includes("--build");

// Extract --url argument (--url=https://... or --url https://...)
let targetUrl = null;
const urlEqualArg = args.find((a) => a.startsWith("--url="));
if (urlEqualArg) {
  targetUrl = urlEqualArg.replace("--url=", "").trim();
} else {
  const urlIdx = args.indexOf("--url");
  if (urlIdx !== -1 && args[urlIdx + 1]) {
    targetUrl = args[urlIdx + 1].trim();
  }
}

async function checkRemoteKey() {
  try {
    const res = await fetch(KEY_LOCATION, { method: "GET" });
    if (!res.ok) return false;
    const body = await res.text();
    return body.trim() === KEY;
  } catch {
    return false;
  }
}

function filterDisallowed(urls) {
  return urls.filter((u) => !EXCLUDED_PATTERNS.some((pattern) => pattern.test(u)));
}

async function discoverUrls() {
  if (targetUrl) {
    const fullUrl = targetUrl.startsWith("http")
      ? targetUrl
      : `${SITE_BASE}${targetUrl.startsWith("/") ? "" : "/"}${targetUrl}`;
    return [fullUrl];
  }

  // 1. Try to fetch live sitemap
  try {
    const res = await fetch(SITEMAP_URL, {
      headers: { "User-Agent": "RSAMDIO-IndexNow-Bot/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const xml = await res.text();
      const matches = [...xml.matchAll(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
      if (matches.length > 0) {
        return filterDisallowed([...new Set(matches)]);
      }
    }
  } catch {
    // Fall back to local sitemap
  }

  // 2. Fall back to local sitemap.xml
  try {
    const localSitemapPath = resolve(ROOT_DIR, "sitemap.xml");
    if (existsSync(localSitemapPath)) {
      const xml = readFileSync(localSitemapPath, "utf-8");
      const matches = [...xml.matchAll(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
      if (matches.length > 0) {
        return filterDisallowed([...new Set(matches)]);
      }
    }
  } catch (err) {
    console.warn("[IndexNow] Could not read local sitemap.xml:", err.message);
  }

  // 3. Fallback to hardcoded canonical public routes
  const defaultRoutes = [
    `${SITE_BASE}/`,
    `${SITE_BASE}/faq.html`,
    `${SITE_BASE}/how-ri-dues-work.html`,
    `${SITE_BASE}/learn/`,
    `${SITE_BASE}/privacy.html`,
    `${SITE_BASE}/terms.html`,
  ];
  return defaultRoutes;
}

async function submitBatch(urls, batchNum, totalBatches) {
  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls,
  };

  if (isDryRun) {
    console.log(`\n[IndexNow] [DRY RUN] Batch ${batchNum}/${totalBatches} (${urls.length} URLs):`);
    console.log(JSON.stringify(payload, null, 2));
    return true;
  }

  console.log(`[IndexNow] Submitting batch ${batchNum}/${totalBatches} (${urls.length} URLs) to ${INDEXNOW_ENDPOINT}...`);
  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 200) {
      console.log(`[IndexNow] ✓ Success: HTTP 200 — ${urls.length} URLs submitted successfully.`);
      return true;
    } else if (res.status === 202) {
      console.log(`[IndexNow] ✓ Accepted: HTTP 202 — ${urls.length} URLs received (key validation pending).`);
      return true;
    } else if (res.status === 400) {
      console.error(`[IndexNow] ✗ HTTP 400 Bad Request — check URL syntax or payload formatting.`);
      return false;
    } else if (res.status === 403) {
      console.error(`[IndexNow] ✗ HTTP 403 Forbidden — key verification failed. Make sure ${KEY_LOCATION} is live and returns "${KEY}".`);
      return false;
    } else if (res.status === 422) {
      console.error(`[IndexNow] ✗ HTTP 422 Unprocessable — URLs must belong to ${HOST}.`);
      return false;
    } else if (res.status === 429) {
      console.warn(`[IndexNow] ⚠ HTTP 429 Rate limited — submitted too frequently.`);
      return false;
    } else {
      const text = await res.text().catch(() => "");
      console.warn(`[IndexNow] Response HTTP ${res.status}: ${text}`);
      return res.ok;
    }
  } catch (err) {
    console.error(`[IndexNow] Network error submitting to IndexNow:`, err.message);
    return false;
  }
}

async function main() {
  console.log(`[IndexNow] Target Host: ${HOST}`);
  console.log(`[IndexNow] Key File:    ${KEY_LOCATION}`);

  // Build mode check (Netlify sets CONTEXT=production for live site deploys)
  if (isBuild) {
    const isProduction = process.env.CONTEXT === "production" || process.env.INDEXNOW_SUBMIT === "1";
    if (!isProduction) {
      console.log(`[IndexNow] Build mode: skipping submission (CONTEXT=${process.env.CONTEXT || "local"}). Set INDEXNOW_SUBMIT=1 to force.`);
      process.exit(0);
    }
  }

  // Remote key verification check
  if (!isDryRun && !isForce) {
    const keyIsLive = await checkRemoteKey();
    if (!keyIsLive) {
      if (isBuild) {
        console.log(`[IndexNow] Notice: Key file not yet verified live at ${KEY_LOCATION}.`);
        console.log(`[IndexNow] Skipping build-time submission until after the deploy goes live.`);
        process.exit(0);
      } else {
        console.warn(`\n[IndexNow] Notice: Key file not yet verified live at:`);
        console.warn(`           ${KEY_LOCATION}`);
        console.warn(`[IndexNow] If you recently added ${KEY_FILENAME}, deploy to Netlify first.`);
        console.warn(`[IndexNow] To submit anyway before the key check succeeds, pass --force:\n`);
        console.warn(`           node scripts/submit-indexnow.mjs --force\n`);
        process.exit(1);
      }
    }
  }

  // URL discovery
  const urls = await discoverUrls();
  if (!urls || urls.length === 0) {
    console.error("[IndexNow] No URLs found to submit.");
    if (isBuild) process.exit(0);
    process.exit(1);
  }

  console.log(`[IndexNow] Discovered ${urls.length} canonical URL(s) to submit.`);

  // Chunk batches (up to 10,000 URLs per IndexNow specification)
  const batches = [];
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    batches.push(urls.slice(i, i + BATCH_SIZE));
  }

  let allSuccess = true;
  for (let i = 0; i < batches.length; i++) {
    const ok = await submitBatch(batches[i], i + 1, batches.length);
    if (!ok) allSuccess = false;
  }

  if (isDryRun) {
    console.log(`\n[IndexNow] Dry run complete. ${urls.length} URLs ready for submission.`);
  } else if (allSuccess) {
    console.log(`[IndexNow] Submission complete.`);
  } else if (isBuild) {
    console.log(`[IndexNow] Build finished with submission warnings (non-fatal).`);
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[IndexNow] Unexpected error:", err);
  if (!isBuild) process.exit(1);
});
