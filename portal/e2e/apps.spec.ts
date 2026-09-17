import { expect, test } from "@playwright/test";

import { signInAs, unique, USERS } from "./helpers";

test("admins register an app, see its secret once, and add a role", async ({ page }) => {
  await signInAs(page, USERS.admin);
  const slug = unique("e2e-app");
  await page.goto("/admin/apps");
  await page.getByLabel("Name", { exact: true }).fill(`E2E ${slug}`);
  await page.getByLabel("Short name").fill(slug);
  await page.getByLabel("App address").fill(`https://${slug}.yourco.com`);
  await page
    .getByLabel("Sign-in callback URLs, one per line")
    .fill(`https://${slug}.yourco.com/api/auth/callback/identity`);
  await page.getByRole("button", { name: "Register app" }).click();

  const status = page.getByRole("status");
  await expect(status).toContainText(`E2E ${slug} registered.`);
  await expect(status).toContainText("Copy the secret now.");

  await page.reload();
  await expect(page.getByText("Copy the secret now.")).toHaveCount(0);
  await page.getByRole("link", { name: `E2E ${slug}` }).click();
  await expect(page.getByRole("heading", { name: `E2E ${slug}` })).toBeVisible();

  await page.getByLabel("Key").fill("approver");
  await page.getByLabel("Label").fill("Approver");
  await page.getByLabel("Rank").fill("20");
  await page.getByRole("button", { name: "Add role" }).click();
  await expect(page.getByRole("row", { name: /Approver approver 20/ })).toBeVisible();
});

test("the built-in portal app cannot be reconfigured", async ({ page }) => {
  await signInAs(page, USERS.admin);
  await page.goto("/admin/apps");
  await page.getByRole("link", { name: "Portal" }).click();
  await expect(page.getByLabel("App address")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Create new secret" })).toHaveCount(0);
});
