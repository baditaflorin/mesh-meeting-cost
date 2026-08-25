import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const appName = pkg.name;

async function openVisualSurface(page: Page): Promise<void> {
  await page.addInitScript((prefix) => {
    localStorage.setItem(`${prefix}:room`, "visual-contract");
    localStorage.setItem(`${prefix}:signalingUrl`, "ws://127.0.0.1:1/never-connects");
    localStorage.setItem(`${prefix}:turnTokenUrl`, "http://127.0.0.1:1/never-connects");
  }, appName);

  await page.goto(`/${appName}/`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("meeting-cost-surface")).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

async function expectAboveFold(page: Page): Promise<void> {
  const primaryAction = page.getByTestId("primary-action");
  await expect(primaryAction).toBeVisible();
  const box = await primaryAction.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? Number.POSITIVE_INFINITY) + (box?.height ?? 0)).toBeLessThanOrEqual(
    page.viewportSize()?.height ?? 0,
  );
}

test("390x844 mobile contract keeps the live metric and action visible without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openVisualSurface(page);

  await expect(page.locator(".cost-money")).toHaveText("$0.00");
  await expectNoHorizontalOverflow(page);
  await expectAboveFold(page);
});

test("1141x602 desktop contract keeps the primary meeting action above the fold", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1141, height: 602 });
  await openVisualSurface(page);

  await expect(page.getByRole("heading", { name: "Meeting cost", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectAboveFold(page);
});
