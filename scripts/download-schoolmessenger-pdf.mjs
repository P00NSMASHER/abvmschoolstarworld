import fs from "node:fs/promises";
import {chromium} from "playwright";

const urlValue = process.env.SCHOOLMESSENGER_DOCUMENT_URL;
const expectedName = process.env.SCHOOLMESSENGER_EXPECTED_FILENAME;
const outputLimit = 8_000_000;
const allowedHosts = new Set([
  "track.spe.schoolmessenger.com",
  "msg.schoolmessenger.com",
]);

function fail(stage) {
  // Keep signed tracking URLs and message content out of action logs.
  process.stderr.write(`SchoolMessenger PDF retrieval failed during ${stage}.\n`);
  process.exitCode = 1;
}

if (!urlValue || !expectedName) {
  fail("configuration");
} else {
  let browser;
  try {
    const start = new URL(urlValue);
    if (start.protocol !== "https:" || start.hostname !== "track.spe.schoolmessenger.com" || start.port) {
      throw new Error("unsafe start URL");
    }

    browser = await chromium.launch({headless: true});
    const context = await browser.newContext({acceptDownloads: true});
    const page = await context.newPage();
    await page.route("**/*", async route => {
      let target;
      try {
        target = new URL(route.request().url());
      } catch {
        await route.abort();
        return;
      }
      if (target.protocol === "https:" && !target.port && allowedHosts.has(target.hostname)) {
        await route.continue();
      } else if (["about:", "blob:", "data:"].includes(target.protocol)) {
        await route.continue();
      } else {
        await route.abort();
      }
    });

    const downloadWait = page.waitForEvent("download", {timeout: 60_000});
    await page.goto(start.href, {waitUntil: "domcontentloaded", timeout: 45_000});
    const download = await downloadWait;
    if (download.suggestedFilename().toLowerCase() !== expectedName.toLowerCase()) {
      throw new Error("unexpected document name");
    }
    const downloadedPath = await download.path();
    if (!downloadedPath) throw new Error("download missing");
    const bytes = await fs.readFile(downloadedPath);
    if (bytes.length < 5 || bytes.length > outputLimit || !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new Error("invalid PDF payload");
    }
    process.stdout.write(bytes);
  } catch {
    fail("download");
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
