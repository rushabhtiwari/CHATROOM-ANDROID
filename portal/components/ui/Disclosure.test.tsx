import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Disclosure } from "@/components/ui/Disclosure";

describe("Disclosure", () => {
  it("shows and hides its panel", () => {
    render(
      <Disclosure label="Add department">
        <p>Form</p>
      </Disclosure>,
    );
    const button = screen.getByRole("button", { name: "Add department" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Form")).not.toBeVisible();

    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Form")).toBeVisible();
  });

  it("closes a menu on Escape", () => {
    render(
      <Disclosure label="More actions" trigger="…" menu>
        <p>Rename</p>
      </Disclosure>,
    );
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "More actions" })).toHaveAttribute("aria-expanded", "false");
  });
});
