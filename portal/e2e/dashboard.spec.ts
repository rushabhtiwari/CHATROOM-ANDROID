import { expect, test } from "@playwright/test";

import { signInAs, USERS } from "./helpers";

test("signed-out visitors are sent to the identity service", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/localhost:8000\/dev-login/);
});

test("people see their department's apps and the company tools", async ({ page }) => {
  await signInAs(page, USERS.sales);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sam");
  const departments = page.getByRole("region", { name: "Departments" });
  const tools = page.getByRole("region", { name: "Company tools" });

  const example = departments.getByRole("link", { name: "Example App" });
  await expect(example).toHaveAttribute("href", "http://localhost:3001");
  await expect(departments.locator('[aria-disabled="true"]', { hasText: "Sales" })).toContainText("Soon");
  await expect(departments.getByText("Dispatch")).toHaveCount(0);
  for (const name of ["Automation", "Chat", "Projects", "Requisitions & Budget"]) {
    await expect(tools.locator('[aria-disabled="true"]', { hasText: name })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("search narrows the launcher", async ({ page }) => {
  await signInAs(page, USERS.sales);
  const search = page.getByRole("searchbox", { name: "Find an app" });

  await search.fill("messages");
  await expect(page.getByText("Chat")).toBeVisible();
  await expect(page.getByText("Projects")).toHaveCount(0);

  await search.fill("payroll");
  await expect(page.getByText('No apps match "payroll".')).toBeVisible();
});

test("people without a department see what to do next", async ({ page }) => {
  await signInAs(page, USERS.newcomer);
  await expect(page.getByText("You don't have any apps yet.")).toBeVisible();
});

test("signing out ends the identity session too", async ({ page }) => {
  await signInAs(page, USERS.sales);
  await page.getByRole("button", { name: `Account menu for ${USERS.sales}` }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/localhost:8000\/dev-login/);
  await page.goto("/");
  await expect(page).toHaveURL(/localhost:8000\/dev-login/);
});
