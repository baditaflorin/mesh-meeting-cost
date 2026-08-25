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
    await a.getByLabel("Your name").fill("Alice");
    await a.getByLabel("hourly rate").fill("100");
    await a.getByRole("button", { name: "Add to team total", exact: true }).click();

    await expect(b.locator(".cost-rate")).toContainText("$100.00/hr");
    await expect(b.locator(".cost-status")).toContainText("1 rate");

    await b.getByLabel("Your name").fill("Bob");
    await b.getByLabel("hourly rate").fill("50");
    await b.getByRole("button", { name: "Add to team total", exact: true }).click();

    await expect(a.locator(".cost-rate")).toContainText("$150.00/hr");
  } finally {
    await cleanup();
  }
});

test("start on A causes time to tick on B", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByLabel("Your name").fill("Alice");
    await a.getByLabel("hourly rate").fill("60");
    await a.getByRole("button", { name: "Add to team total", exact: true }).click();

    await a.getByRole("button", { name: "Start meeting", exact: true }).click();

    await expect(b.getByRole("button", { name: "Pause meeting", exact: true })).toBeVisible();
    await b.waitForTimeout(1100);
    await expect(b.locator(".cost-time")).not.toHaveText("00:00");
  } finally {
    await cleanup();
  }
});

// The headline advertised claim is "see what the MEETING IS COSTING in real
// time". The tests above prove the burn RATE and the elapsed time sync, but
// never assert the actual cost-money meter accumulates past $0 — and never
// assert the two peers agree on the running cost. This drives the full meter:
// both peers contribute rates, A starts the session, and the OPPOSITE peer (B)
// must show a rising non-zero dollar figure that matches A's, in real time.
const money = (text: string): number => Number(text.replace(/[^0-9.]/g, ""));

test("running cost meter accumulates on the opposite peer and both agree", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Big rates so the meter moves a measurable amount within a couple seconds.
    await a.getByLabel("Your name").fill("Alice");
    await a.getByLabel("hourly rate").fill("3600"); // $1.00 / sec
    await a.getByRole("button", { name: "Add to team total", exact: true }).click();

    await b.getByLabel("Your name").fill("Bob");
    await b.getByLabel("hourly rate").fill("3600"); // +$1.00 / sec → $2.00 / sec total
    await b.getByRole("button", { name: "Add to team total", exact: true }).click();

    // Both peers must agree the combined burn rate crossed the mesh.
    await expect(a.locator(".cost-rate")).toContainText("$7,200.00/hr");
    await expect(b.locator(".cost-rate")).toContainText("$7,200.00/hr");

    // Cost is $0 before the shared session starts.
    await expect(b.locator(".cost-money")).toHaveText("$0.00");

    // A starts the meeting; the running flag must propagate to B.
    await a.getByRole("button", { name: "Start meeting", exact: true }).click();
    await expect(b.getByRole("button", { name: "Pause meeting", exact: true })).toBeVisible();

    // On the OPPOSITE peer (B), the money meter must climb above zero in real
    // time — this is the advertised "see what the meeting is costing".
    await expect
      .poll(async () => money(await b.locator(".cost-money").innerText()), { timeout: 6000 })
      .toBeGreaterThan(1);

    // And both peers must agree on the running cost (same shared session clock +
    // same shared rate total → same dollar figure, within rounding/tick slack).
    const onA = money(await a.locator(".cost-money").innerText());
    const onB = money(await b.locator(".cost-money").innerText());
    expect(onA).toBeGreaterThan(1);
    expect(Math.abs(onA - onB)).toBeLessThan(3); // ≤ ~1.5 ticks of $2/sec drift
  } finally {
    await cleanup();
  }
});

test("two peers share the complete meeting control loop", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByLabel("Your name").fill("Avery");
    await a.getByLabel("hourly rate").fill("3600");
    await a.getByRole("button", { name: "Add to team total", exact: true }).click();

    await b.getByLabel("Your name").fill("Blair");
    await b.getByLabel("hourly rate").fill("1800");
    await b.getByRole("button", { name: "Add to team total", exact: true }).click();

    await expect(a.getByTestId("room-presence")).toContainText("2");
    await expect(b.locator(".cost-rate")).toContainText("$5,400.00/hr");

    await b.getByRole("button", { name: "Start meeting", exact: true }).click();
    await expect(a.getByRole("button", { name: "Pause meeting", exact: true })).toBeVisible();
    await expect
      .poll(async () => money(await a.locator(".cost-money").innerText()), { timeout: 6000 })
      .toBeGreaterThan(0.5);

    await a.getByRole("button", { name: "Pause meeting", exact: true }).click();
    await expect(b.getByRole("button", { name: "Resume meeting", exact: true })).toBeVisible();
  } finally {
    await cleanup();
  }
});
