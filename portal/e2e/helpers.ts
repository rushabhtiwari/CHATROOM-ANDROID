import { expect, type Page } from "@playwright/test";

/** Seeded users from identity/app/seed.py. */
export const USERS = {
  admin: "Ada Admin",
  sales: "Sam Sales",
  finance: "Fiona Finance",
  newcomer: "Nia New",
} as const;

/** Signs in through the identity service's development login. */
export async function signInAs(page: Page, name: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/localhost:8000\/dev-login/);
  await page.getByRole("button", { name: new RegExp(`^${name} `) }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

export function unique(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}`;
}
