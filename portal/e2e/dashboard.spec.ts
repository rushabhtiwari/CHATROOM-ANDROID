import { expect, test } from "@playwright/test";

import { signInAs, USERS } from "./helpers";

test("signed-out visitors are sent to the identity service", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/localhost:8000\/dev-login/);
});

test("people see the apps their department gives them", async ({ page }) => {
  await signInAs(page, USERS.sales);

  await expect(page.getByRole("heading", { name: "Hello, Sam" })).toBeVisible();
  const tile = page.getByRole("link", { name: /Example App/ });
  await expect(tile).toHaveAttribute("href", "http://localhost:3001");
  await expect(tile).toContainText("Your role: manager");
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("people without a department see what to do next", async ({ page }) => {
  await signInAs(page, USERS.newcomer);
  await expect(page.getByRole("heading", { name: "No apps yet" })).toBeVisible();
});

test("signing out ends the identity session too", async ({ page }) => {
  await signInAs(page, USERS.sales);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/localhost:8000\/dev-login/);
  await page.goto("/");
  await expect(page).toHaveURL(/localhost:8000\/dev-login/);
});
