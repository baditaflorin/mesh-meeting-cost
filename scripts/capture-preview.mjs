import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const appName = "mesh-meeting-cost";
const previewUrl = process.env.MESH_PREVIEW_URL ?? `http://127.0.0.1:4174/${appName}/`;
const outputPath = process.env.MESH_PREVIEW_OUTPUT
  ? resolve(process.env.MESH_PREVIEW_OUTPUT)
  : fileURLToPath(new URL("../public/meeting-cost-preview.png", import.meta.url));
const width = Number(process.env.MESH_PREVIEW_WIDTH ?? 1440);
const height = Number(process.env.MESH_PREVIEW_HEIGHT ?? 900);

await mkdir(dirname(outputPath), { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript((prefix) => {
    localStorage.setItem(`${prefix}:room`, "documentation-preview");
    localStorage.setItem(`${prefix}:signalingUrl`, "ws://127.0.0.1:1/never-connects");
    localStorage.setItem(`${prefix}:turnTokenUrl`, "http://127.0.0.1:1/never-connects");
  }, appName);

  await page.goto(previewUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("meeting-cost-surface").waitFor({ state: "visible" });
  await page.getByLabel("Your name").fill("Avery");
  await page.getByLabel("hourly rate").fill("185");
  await page.getByRole("button", { name: "Add to team total", exact: true }).click();
  await page.getByRole("button", { name: "Start meeting", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  await page.screenshot({ path: outputPath });
} finally {
  await browser.close();
}
