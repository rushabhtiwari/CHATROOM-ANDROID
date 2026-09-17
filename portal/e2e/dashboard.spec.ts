import { expect, test } from "@playwright/test";

import { signInAs, USERS } from "./helpers";

test("signed-out visitors are sent to the identity service", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/localhost:8000\/dev-login/);
});

test("people see their department's apps and the company tools", async ({ page }) => {
  await signInAs(page, USERS.sales);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sam");
  await expect(page.getByRole("list", { name: "Summary" })).toContainText("Apps you can open");
  const departments = page.getByRole("region", { name: "Departments" });
  const tools = page.getByRole("region", { name: "Company tools" });

  const example = departments.getByRole("link", { name: "Example App" });
  await expect(example).toHaveAttribute("href", "http://localhost:3001");
  await expect(example).toContainText("Manager");
  await expect(departments.locator('[aria-disabled="true"]', { hasText: "Sales" })).toContainText("Coming soon");
  await expect(departments.getByText("Dispatch")).toHaveCount(0);
  for (const name of ["Automation", "Chat", "Projects", "Requisitions & Budget"]) {
    await expect(tools.locator('[aria-disabled="true"]', { hasText: name })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("filters and search narrow the apps", async ({ page }) => {
  await signInAs(page, USERS.sales);

  await page.getByRole("switch", { name: "Live only" }).click();
  await expect(page.getByRole("link", { name: "Example App" })).toBeVisible();
  await expect(page.getByText("Chat")).toHaveCount(0);
  await page.getByRole("switch", { name: "Live only" }).click();

  const search = page.getByRole("searchbox", { name: "Search apps" });
  await page.keyboard.press("ControlOrMeta+k");
  await expect(search).toBeFocused();
  await search.fill("messages");
  await expect(page).toHaveURL(/\?q=messages/);
  await expect(page.getByText("Chat", { exact: true })).toBeVisible();
  await expect(page.getByText("Projects")).toHaveCount(0);

  await search.fill("payroll");
  await expect(page.getByText('No apps match "payroll".')).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByText("Projects")).toBeVisible();
});

test("searching from an admin page opens the filtered home page", async ({ page }) => {
  await signInAs(page, USERS.admin);
  await page.goto("/admin/users");
  const search = page.getByRole("searchbox", { name: "Search apps" });
  await search.fill("dispatch");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/\?q=dispatch$/);
  await expect(page.getByRole("region", { name: "Departments" })).toContainText("Dispatch");
  await expect(page.getByText("Chat")).toHaveCount(0);
});

test("people without a department see what to do next", async ({ page }) => {
  await signInAs(page, USERS.newcomer);
  await expect(page.getByRole("heading", { name: "No apps yet" })).toBeVisible();
});

test("signing out ends the identity session too", async ({ page }) => {
  await signInAs(page, USERS.sales);
  await page.getByRole("button", { name: `Account menu for ${USERS.sales}` }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/localhost:8000\/dev-login/);
  await page.goto("/");
  await expect(page).toHaveURL(/localhost:8000\/dev-login/);
});
