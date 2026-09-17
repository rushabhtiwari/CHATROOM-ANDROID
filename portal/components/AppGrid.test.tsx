import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppGrid } from "@/components/AppGrid";

describe("AppGrid", () => {
  it("links each app tile to its launch URL in a new tab", () => {
    render(
      <AppGrid
        apps={[
          {
            slug: "crm",
            name: "Sales CRM",
            description: "Leads and deals",
            icon: "",
            launch_url: "https://crm.yourco.com",
            category: "department",
            status: "active",
            logo_version: null,
            role: "manager",
          },
        ]}
      />,
    );
    const link = screen.getByRole("link", { name: /Sales CRM/ });
    expect(link).toHaveAttribute("href", "https://crm.yourco.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("SC");
    expect(link).toHaveTextContent("Your role: manager");
  });

  it("explains what to do when there are no apps", () => {
    render(<AppGrid apps={[]} />);
    expect(screen.getByRole("heading", { name: "No apps yet" })).toBeInTheDocument();
    expect(screen.getByText(/Ask an admin/)).toBeInTheDocument();
  });
});
