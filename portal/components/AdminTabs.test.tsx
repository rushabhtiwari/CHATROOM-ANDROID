import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminTabs } from "@/components/AdminTabs";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/apps/123" }));

describe("AdminTabs", () => {
  it("marks the section containing the current page", () => {
    render(<AdminTabs />);
    expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Apps" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "People" })).not.toHaveAttribute("aria-current");
  });
});
