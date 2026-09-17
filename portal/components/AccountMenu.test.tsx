import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccountMenu } from "@/components/AccountMenu";

function renderMenu() {
  return render(
    <AccountMenu name="Ada Admin" email="admin@yourco.com" roleLine="Administrator">
      <button type="button">Sign out</button>
    </AccountMenu>,
  );
}

describe("AccountMenu", () => {
  it("shows initials and opens to reveal the account and sign-out", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Account menu for Ada Admin" });
    expect(trigger).toHaveTextContent("AA");
    expect(trigger).toHaveTextContent("Ada Admin");
    expect(trigger).toHaveTextContent("Administrator");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("admin@yourco.com")).toBeNull();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("admin@yourco.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("closes on Escape and on clicks outside", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Account menu for Ada Admin" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
