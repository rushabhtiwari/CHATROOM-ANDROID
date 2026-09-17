import { expect, test } from "@playwright/test";

import { signInAs, unique, USERS } from "./helpers";

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await signInAs(page, USERS.admin);
});

test("the apps list shows group, status and access, and filters", async ({ page }) => {
  await page.goto("/admin/apps");
  const chat = page.getByRole("row", { name: /^Chat/ });
  await expect(chat).toContainText("Company tools");
  await expect(chat).toContainText("Coming soon");
  await expect(chat).toContainText("All 9 departments");
  await expect(page.getByRole("row", { name: /Example App/ })).toContainText("Live");

  await page.getByRole("combobox", { name: "Status" }).selectOption({ label: "Live" });
  await expect(page.getByRole("row", { name: /^Chat/ })).toHaveCount(0);
  await expect(page.getByRole("row", { name: /Example App/ })).toBeVisible();
});

test("admins register a coming-soon app, then take it live", async ({ page }) => {
  const slug = unique("e2e-app");
  await page.goto("/admin/apps");
  await page.getByRole("link", { name: "Register app" }).click();
  await expect(page.getByRole("heading", { name: "Register app" })).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(`E2E ${slug}`);
  await page.getByLabel("Short name").fill(slug);
  await page.getByRole("radio", { name: "Company tools" }).check({ force: true });
  await page.getByRole("radio", { name: "warehouse" }).check({ force: true });
  await page.getByRole("button", { name: "Register app" }).click();

  const created = page.getByRole("status");
  await expect(created).toContainText(`E2E ${slug} registered.`);
  await expect(created).toContainText("Copy the secret now.");
  await created.getByRole("link", { name: `Open E2E ${slug}` }).click();

  await expect(page.getByRole("heading", { name: `E2E ${slug}` })).toBeVisible();
  await expect(page.getByRole("radio", { name: "warehouse" })).toBeChecked();

  const settings = page.getByRole("region", { name: "Settings" });
  await settings.getByRole("radio", { name: "Live" }).check({ force: true });
  await settings.getByRole("button", { name: "Save changes" }).click();
  await expect(settings.getByRole("alert")).toContainText("before it can go live");

  const connection = page.getByRole("region", { name: "Connection" });
  await connection.getByLabel("App address").fill(`https://${slug}.yourco.com`);
  await connection.getByLabel("Sign-in callback URLs").fill(`https://${slug}.yourco.com/api/auth/callback/identity`);
  await connection.getByRole("button", { name: "Save connection" }).click();
  await expect(connection.getByRole("status")).toContainText("Connection saved.");

  await settings.getByRole("radio", { name: "Live" }).check({ force: true });
  await settings.getByRole("button", { name: "Save changes" }).click();
  await expect(settings.getByRole("status")).toContainText("Changes saved.");
  await expect(page.locator(".page-header")).toContainText("Live");

  const roles = page.getByRole("region", { name: "Roles" });
  await roles.getByLabel("Key").fill("approver");
  await roles.getByLabel("Label").fill("Approver");
  await roles.getByLabel("Rank").fill("20");
  await roles.getByRole("button", { name: "Add role" }).click();
  await expect(roles.getByRole("row", { name: /Approver approver 20/ })).toBeVisible();
});

test("admins upload a logo that people see on the home page", async ({ page }) => {
  await page.goto("/admin/apps");
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  const logo = page.getByRole("region", { name: "Logo" });

  await logo.getByLabel(/Upload a logo/).setInputFiles({ name: "chat.png", mimeType: "image/png", buffer: PNG });
  await logo.getByRole("button", { name: "Upload logo" }).click();
  await expect(logo.locator(".app-mark img")).toBeVisible();

  await page.goto("/");
  const card = page
    .getByRole("region", { name: "Company tools" })
    .locator('[aria-disabled="true"]', { hasText: "Chat" });
  const src = await card.locator("img").getAttribute("src");
  expect(src).toMatch(/\/logos\/chat\?v=\d+/);
  expect((await page.request.get(src ?? "")).headers()["content-type"]).toBe("image/png");

  await page.goto("/admin/apps");
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.getByRole("region", { name: "Logo" }).getByRole("button", { name: "Remove logo" }).click();
  await expect(page.getByRole("region", { name: "Logo" }).locator(".app-mark img")).toHaveCount(0);
});

test("the built-in portal app cannot be reconfigured", async ({ page }) => {
  await page.goto("/admin/apps");
  await page.getByRole("link", { name: "Portal", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Portal" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Connection" })).toContainText("deployment settings");
  await expect(page.getByRole("button", { name: "Create new secret" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Logo" })).toHaveCount(0);
});
