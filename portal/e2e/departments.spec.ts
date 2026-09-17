import { expect, test } from "@playwright/test";

import { signInAs, unique, USERS } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInAs(page, USERS.admin);
});

test("admins give a new department access and add a person to it", async ({ page }) => {
  const slug = unique("e2e-dept");
  await page.goto("/admin/departments");
  await page.getByLabel("Name", { exact: true }).fill(`Dept ${slug}`);
  await page.getByLabel("Short name").fill(slug);
  await page.getByRole("button", { name: "Add department" }).click();
  await expect(page.getByRole("status")).toContainText(`Dept ${slug} created.`);

  const department = page.getByRole("article", { name: `Dept ${slug}` });
  await department.getByLabel("Example App").selectOption({ label: "Viewer" });
  await department.getByRole("button", { name: "Save access" }).click();
  await expect(department.getByRole("status")).toContainText("Access saved.");

  await page.goto("/admin/users?query=newbie");
  await page.getByRole("link", { name: USERS.newcomer }).click();
  await expect(page.getByRole("heading", { name: USERS.newcomer })).toBeVisible();
  await page.getByRole("checkbox", { name: `Dept ${slug}` }).check();
  await page.getByRole("button", { name: "Save departments" }).click();
  await expect(page.getByText("Departments saved.")).toBeVisible();
  await expect(page.getByRole("row", { name: /Example App/ })).toContainText(`From the Dept ${slug} department`);

  // Leave the seeded newcomer without access for the dashboard tests.
  await page.getByRole("checkbox", { name: `Dept ${slug}` }).uncheck();
  await page.getByRole("button", { name: "Save departments" }).click();
  await expect(page.getByRole("row", { name: /Example App/ })).toContainText("No access");
});

test("admins see why a change was refused", async ({ page }) => {
  await page.goto("/admin/departments");
  await page.getByLabel("Name", { exact: true }).fill("Sales again");
  await page.getByLabel("Short name").fill("sales");
  await page.getByRole("button", { name: "Add department" }).click();
  await expect(page.locator(".form-error")).toHaveText("Department 'sales' already exists");
});
