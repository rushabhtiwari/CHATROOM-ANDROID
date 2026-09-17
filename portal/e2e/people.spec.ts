import { expect, test } from "@playwright/test";

import { signInAs, USERS } from "./helpers";

test("the admin area is hidden from non-admins", async ({ page }) => {
  await signInAs(page, USERS.finance);
  const response = await page.goto("/admin/users");
  expect(response?.status()).toBe(404);
});

test("admins find a person and see why they have access", async ({ page }) => {
  await signInAs(page, USERS.admin);
  await page.getByRole("link", { name: "Admin" }).click();
  await page.getByLabel("Name or email").fill("sam@");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: USERS.sales }).click();

  await expect(page.getByRole("heading", { name: USERS.sales })).toBeVisible();
  const row = page.getByRole("row", { name: /Example App/ });
  await expect(row).toContainText("Manager");
  await expect(row).toContainText("From the Sales department");
});

test("admins grant and remove an exception", async ({ page }) => {
  await signInAs(page, USERS.admin);
  await page.goto("/admin/users?query=newbie");
  await page.getByRole("link", { name: USERS.newcomer }).click();
  await expect(page.getByRole("heading", { name: USERS.newcomer })).toBeVisible();

  const grantViewer = page.locator('optgroup[label="Example App"] option', { hasText: "Grant Viewer" });
  await page.getByRole("combobox", { name: "Exception" }).selectOption((await grantViewer.getAttribute("value")) ?? "");
  await page.getByLabel("Reason").fill("Covering month-end close");
  await page.getByRole("button", { name: "Add exception" }).click();
  await expect(page.getByText("Exception added.")).toBeVisible();
  await expect(page.getByRole("row", { name: /Example App Viewer/ })).toContainText("Granted by an exception");

  await page
    .getByRole("row", { name: /Covering month-end close/ })
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page.getByRole("row", { name: /Example App/ }).first()).toContainText("No access");
});
