import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("rate added by A increases burn rate shown on B", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await a.getByPlaceholder("$/hour").fill("100");
    await a.getByRole("button", { name: "add to total", exact: true }).click();

    await expect(b.locator(".cost-rate")).toContainText("$100.00/hr");
    await expect(b.locator(".cost-status")).toContainText("1 rate");

    await b.getByPlaceholder("your name").fill("bob");
    await b.getByPlaceholder("$/hour").fill("50");
    await b.getByRole("button", { name: "add to total", exact: true }).click();

    await expect(a.locator(".cost-rate")).toContainText("$150.00/hr");
  } finally {
    await cleanup();
  }
});

test("start on A causes time to tick on B", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await a.getByPlaceholder("$/hour").fill("60");
    await a.getByRole("button", { name: "add to total", exact: true }).click();

    await a.getByRole("button", { name: "▶ start", exact: true }).click();

    await expect(b.getByRole("button", { name: "⏸ pause", exact: true })).toBeVisible();
    await b.waitForTimeout(1100);
    await expect(b.locator(".cost-time")).not.toHaveText("00:00");
  } finally {
    await cleanup();
  }
});
