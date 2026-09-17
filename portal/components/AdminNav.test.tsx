import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminNav } from "@/components/AdminNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/users/123" }));

describe("AdminNav", () => {
  it("marks the section containing the current page", () => {
    render(<AdminNav />);
    expect(screen.getByRole("link", { name: "People" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Apps" })).not.toHaveAttribute("aria-current");
  });
});
