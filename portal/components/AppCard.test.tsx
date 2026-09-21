import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppCard } from "@/components/AppCard";
import type { MyApp } from "@/lib/types";

const live: MyApp = {
  slug: "example",
  name: "Example App",
  description: "Reference integration",
  category: "department",
  status: "active",
  icon: "app-window",
  logo_version: null,
  launch_url: "http://localhost:3001",
  role: "manager",
};

describe("AppCard", () => {
  it("makes a live app's whole card a link that opens in a new tab", () => {
    render(<AppCard app={live} />);
    const link = screen.getByRole("link", { name: "Example App" });
    expect(link).toHaveAttribute("href", "http://localhost:3001");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAccessibleDescription("Reference integration");
    expect(link).not.toHaveTextContent("Coming soon");
  });

  it("shows coming-soon apps as a disabled card without a link", () => {
    render(
      <AppCard
        app={{ ...live, slug: "chat", name: "Chat", category: "company", status: "coming_soon", launch_url: "" }}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    const card = screen.getByText("Chat").closest("[aria-disabled]") as HTMLElement;
    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(card).toHaveTextContent("Coming soon");
  });
});
