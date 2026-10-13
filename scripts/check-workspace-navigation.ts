import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium, expect } = require(process.argv[2] ?? "@playwright/test");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error: Error) => errors.push(error.message));
  await page.goto(
    `${process.argv[3] ?? "http://127.0.0.1:5173"}/?design=demo-evergreen`,
  );
  await page.getByText("Shared storage connected", { exact: true }).waitFor();
  const cards = page.locator(".stats .stat-card");
  const count = async (index: number) =>
    parseInt(await cards.nth(index).locator("strong").innerText());
  const designs = await count(0);
  const versions = await count(1);
  const ready = await count(2);

  await page
    .getByLabel("Search designs", { exact: true })
    .fill("No matching design");
  await page
    .getByLabel("Filter by status", { exact: true })
    .selectOption("In review");
  await cards.nth(2).click();
  await expect(page.locator(".design-grid .design-card")).toHaveCount(ready);
  await expect(page.getByLabel("Search designs", { exact: true })).toHaveValue(
    "",
  );
  await expect(
    page.getByLabel("Filter by status", { exact: true }),
  ).toHaveValue("All statuses");
  await expect(cards.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(".design-grid .design-card").first(),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#workspace-results")).toBeFocused();

  await cards.nth(1).click();
  await expect(page.locator(".activity-page > button")).toHaveCount(versions);
  await expect(cards.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#workspace-results")).toBeFocused();
  await page.getByRole("button", { name: "Back to grid", exact: true }).click();
  await expect(page.locator(".design-grid .design-card")).toHaveCount(designs);

  await page
    .getByRole("group", { name: "Filter by category", exact: true })
    .getByRole("button", { name: "Website", exact: true })
    .click();
  await cards.nth(0).click();
  await expect(page.locator(".design-grid .design-card")).toHaveCount(designs);
  await expect(cards.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#workspace-results")).toBeFocused();

  await page
    .locator(".design-grid .design-card")
    .filter({ hasText: "Evergreen storefront" })
    .click();
  await page.getByRole("tab", { name: "Compare", exact: true }).click();
  await expect(page.locator(".app")).toHaveClass("app comparing");
  await page
    .getByRole("navigation", { name: "Workspace views", exact: true })
    .getByRole("button", { name: "Ready for dev", exact: true })
    .click();
  await expect(page.locator(".app")).toHaveClass("app");
  await expect(page.locator(".design-grid .design-card")).toHaveCount(ready);
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await cards.nth(1).click();
  await expect(page.locator(".activity-page > button")).toHaveCount(versions);
  assert.deepEqual(errors, []);
  console.log("Workspace navigation browser checks passed.");
} finally {
  await browser.close();
}
