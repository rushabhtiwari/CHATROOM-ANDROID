import { expect, test } from "@playwright/test";

import { signInAs, USERS } from "./helpers";

test("the activity log shows who signed in", async ({ page }) => {
  await signInAs(page, USERS.admin);
  await page.goto("/admin/audit");
  await page.getByLabel("Event").fill("login");
  await page.getByRole("button", { name: "Filter" }).click();

  await expect(page).toHaveURL(/event=login/);
  const firstEntry = page.getByRole("row").nth(1);
  await expect(firstEntry).toContainText("login");
  await expect(firstEntry).toContainText("admin@yourco.com");
});
