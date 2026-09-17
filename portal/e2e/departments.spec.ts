import { expect, test } from "@playwright/test";

import { signInAs, unique, USERS } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInAs(page, USERS.admin);
});

async function addDepartment(page: import("@playwright/test").Page, name: string, slug: string) {
  await page.goto("/admin/departments");
  await page.getByRole("button", { name: "Add department" }).click();
  const form = page.getByRole("region", { name: "New department" });
  await form.getByLabel("Name", { exact: true }).fill(name);
  await form.getByLabel("Short name").fill(slug);
  await form.getByRole("button", { name: "Create department" }).click();
  return form;
}

test("admins give a new department access and add a person to it", async ({ page }) => {
  const slug = unique("e2e-dept");
  const form = await addDepartment(page, `Dept ${slug}`, slug);
  await expect(form.getByRole("status")).toContainText(`Dept ${slug} created.`);

  const department = page.getByRole("region", { name: `Dept ${slug}` });
  await expect(department).toContainText("0 people");
  await department.getByLabel("Example App").selectOption({ label: "Viewer" });
  await department.getByRole("button", { name: "Save access" }).click();
  await expect(department.getByRole("status")).toContainText("Access saved.");

  await page.goto("/admin/users?query=newbie");
  await page.getByRole("link", { name: USERS.newcomer }).click();
  await expect(page.getByRole("heading", { name: USERS.newcomer })).toBeVisible();
  await page.getByRole("checkbox", { name: `Dept ${slug}` }).check({ force: true });
  await page.getByRole("button", { name: "Save departments" }).click();
  await expect(page.getByText("Departments saved.")).toBeVisible();
  await expect(page.getByRole("row", { name: /Example App/ })).toContainText(`From the Dept ${slug} department`);

  // Leave the seeded newcomer without access for the dashboard tests.
  await page.getByRole("checkbox", { name: `Dept ${slug}` }).uncheck({ force: true });
  await page.getByRole("button", { name: "Save departments" }).click();
  await expect(page.getByRole("row", { name: /Example App/ })).toContainText("No access");

  // Remove the test department again.
  await page.goto("/admin/departments");
  const created = page.getByRole("region", { name: `Dept ${slug}` });
  await created.getByRole("button", { name: `More actions for Dept ${slug}` }).click();
  await created.getByRole("button", { name: "Delete department" }).click();
  await expect(page.getByRole("region", { name: `Dept ${slug}` })).toHaveCount(0);
});

test("admins see why a change was refused", async ({ page }) => {
  const form = await addDepartment(page, "Sales again", "sales");
  await expect(form.getByRole("alert")).toHaveText("Department 'sales' already exists");
});
