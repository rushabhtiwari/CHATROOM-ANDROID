import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppsTable } from "@/components/admin/AppsTable";
import type { AppSummary } from "@/lib/types";

function app(slug: string, patch: Partial<AppSummary> = {}): AppSummary {
  return {
    id: `id-${slug}`,
    slug,
    name: slug[0].toUpperCase() + slug.slice(1),
    description: `${slug} description`,
    icon: "",
    launch_url: "",
    client_id: slug,
    redirect_uris: [],
    post_logout_redirect_uris: [],
    status: "coming_soon",
    is_system: false,
    category: "department",
    logo_version: null,
    roles: [],
    departments: [],
    ...patch,
  };
}

const APPS = [
  app("sales", { status: "active", departments: [{ slug: "sales", name: "Sales" }] }),
  app("chat", {
    category: "company",
    departments: Array.from({ length: 2 }, (_, i) => ({ slug: `d${i}`, name: `D${i}` })),
  }),
  app("legacy", { status: "disabled" }),
  app("portal", { is_system: true, status: "active", name: "Portal" }),
];

describe("AppsTable", () => {
  it("lists apps with group, status, client ID and access, each row linking to the app", () => {
    render(<AppsTable apps={APPS} departmentCount={2} />);
    const sales = screen.getByRole("row", { name: /Sales/ });
    expect(within(sales).getByRole("link", { name: "Sales" })).toHaveAttribute("href", "/admin/apps/id-sales");
    expect(sales).toHaveTextContent("Departments");
    expect(sales).toHaveTextContent("Live");
    expect(sales).toHaveTextContent("sales");
    expect(screen.getByRole("row", { name: /Chat/ })).toHaveTextContent("All 2 departments");
    expect(screen.getByRole("row", { name: /Legacy/ })).toHaveTextContent("None");
    const portal = screen.getByRole("row", { name: /Portal/ });
    expect(portal).toHaveTextContent("Built in");
    expect(portal).toHaveTextContent("Everyone");
    expect(screen.getByText("4 apps")).toBeInTheDocument();
  });

  it("filters by text, group and status", () => {
    render(<AppsTable apps={APPS} departmentCount={2} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter apps" }), { target: { value: "CHAT" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("1 app")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Filter apps" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "disabled" } });
    expect(screen.getByRole("row", { name: /Legacy/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Sales/ })).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Group" }), { target: { value: "company" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);

    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "disabled" } });
    expect(screen.getByText("No apps match these filters.")).toBeInTheDocument();
  });
});
