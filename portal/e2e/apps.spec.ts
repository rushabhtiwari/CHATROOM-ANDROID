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

test("the apps list shows each app's group and status", async ({ page }) => {
  await page.goto("/admin/apps");
  const chat = page.getByRole("row", { name: /Chat/ });
  await expect(chat).toContainText("Company tools");
  await expect(chat).toContainText("Coming soon");
  await expect(page.getByRole("row", { name: /Example App/ })).toContainText("Live");
});

test("admins register a coming-soon app, then take it live", async ({ page }) => {
  const slug = unique("e2e-app");
  await page.goto("/admin/apps");
  await page.getByLabel("Name", { exact: true }).fill(`E2E ${slug}`);
  await page.getByLabel("Short name").fill(slug);
  await page.getByRole("radio", { name: "Company tools" }).check();
  await page.getByRole("radio", { name: "warehouse" }).check({ force: true });
  await page.getByRole("button", { name: "Register app" }).click();

  await expect(page.getByRole("status")).toContainText(`E2E ${slug} registered.`);
  await expect(page.getByRole("status")).toContainText("Copy the secret now.");

  await page.reload();
  await page.getByRole("link", { name: `E2E ${slug}` }).click();
  await expect(page.getByRole("heading", { name: `E2E ${slug}` })).toBeVisible();
  await expect(page.getByRole("radio", { name: "warehouse" })).toBeChecked();

  const settings = page.getByRole("region", { name: "Settings" });
  await settings.getByLabel("Status").selectOption({ label: "Live" });
  await settings.getByRole("button", { name: "Save changes" }).click();
  await expect(settings.locator(".form-error")).toContainText("before it can go live");

  await settings.getByLabel("App address").fill(`https://${slug}.yourco.com`);
  await settings
    .getByLabel("Sign-in callback URLs, one per line")
    .fill(`https://${slug}.yourco.com/api/auth/callback/identity`);
  await settings.getByRole("button", { name: "Save changes" }).click();
  await expect(settings.getByRole("status")).toContainText("Changes saved.");

  await page.getByLabel("Key").fill("approver");
  await page.getByLabel("Label").fill("Approver");
  await page.getByLabel("Rank").fill("20");
  await page.getByRole("button", { name: "Add role" }).click();
  await expect(page.getByRole("row", { name: /Approver approver 20/ })).toBeVisible();
});

test("admins upload a logo that people see in the launcher", async ({ page }) => {
  await page.goto("/admin/apps");
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  const logo = page.getByRole("region", { name: "Logo" });

  await logo.getByLabel("Logo image").setInputFiles({ name: "chat.png", mimeType: "image/png", buffer: PNG });
  await logo.getByRole("button", { name: "Upload logo" }).click();
  await expect(logo.getByRole("status")).toContainText("Logo saved.");

  await page.goto("/");
  const tile = page
    .getByRole("region", { name: "Company tools" })
    .locator('[aria-disabled="true"]', { hasText: "Chat" });
  await expect(tile.locator("img")).toHaveAttribute("src", /\/logos\/chat\?v=\d+/);
  expect(
    (await page.request.get((await tile.locator("img").getAttribute("src")) ?? "")).headers()["content-type"],
  ).toBe("image/png");

  await page.goto("/admin/apps");
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await page.getByRole("region", { name: "Logo" }).getByRole("button", { name: "Remove logo" }).click();
  // Once removed, the preview falls back to the icon and the upload button is back.
  await expect(page.getByRole("region", { name: "Logo" }).getByRole("button", { name: "Upload logo" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Logo" }).locator(".tile-mark img")).toHaveCount(0);
  await page.goto("/");
  await expect(
    page
      .getByRole("region", { name: "Company tools" })
      .locator('[aria-disabled="true"]', { hasText: "Chat" })
      .locator("img"),
  ).toHaveCount(0);
});

test("the built-in portal app cannot be reconfigured", async ({ page }) => {
  await page.goto("/admin/apps");
  await page.getByRole("link", { name: "Portal" }).click();
  await expect(page.getByLabel("App address")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Create new secret" })).toHaveCount(0);
});
