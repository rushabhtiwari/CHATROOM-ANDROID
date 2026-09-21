import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEARCH_SET_EVENT, SEARCH_SUBMIT_EVENT } from "@/components/GlobalSearch";
import { Home } from "@/components/Home";
import type { MyApp } from "@/lib/types";

let query = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query ? { q: query } : {}),
}));

const base = { description: "", icon: "", logo_version: null, role: "member" } as const;
const APPS: MyApp[] = [
  {
    ...base,
    slug: "example",
    name: "Example App",
    category: "department",
    status: "active",
    launch_url: "http://localhost:3001",
  },
  {
    ...base,
    slug: "sales",
    name: "Sales",
    category: "department",
    status: "coming_soon",
    launch_url: "",
    description: "Orders and invoices",
  },
  { ...base, slug: "chat", name: "Chat", category: "company", status: "coming_soon", launch_url: "" },
];

function renderHome(props: Partial<Parameters<typeof Home>[0]> = {}) {
  return render(<Home apps={APPS} firstName="Ada" isAdmin {...props} />);
}

beforeEach(() => {
  query = "";
});
afterEach(() => vi.restoreAllMocks());

describe("Home", () => {
  it("greets the person and offers admins the apps shortcut", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Ada$/);
    expect(screen.queryByRole("list", { name: "Summary" })).toBeNull();
    expect(screen.getByRole("link", { name: "Manage apps" })).toHaveAttribute("href", "/admin/apps");
  });

  it("hides the admin shortcut from non-admins", () => {
    renderHome({ isAdmin: false });
    expect(screen.queryByRole("link", { name: "Manage apps" })).toBeNull();
  });

  it("shows grouped sections with counts and filters by tab and live-only", () => {
    renderHome();
    expect(screen.getByRole("region", { name: "Departments" })).toHaveTextContent("2");
    expect(screen.getByRole("region", { name: "Company tools" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Company tools 1" }));
    expect(screen.queryByRole("region", { name: "Departments" })).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "All 3" }));
    fireEvent.click(screen.getByRole("switch", { name: "Live only" }));
    expect(screen.getByRole("link", { name: "Example App" })).toBeInTheDocument();
    expect(screen.queryByText("Sales")).toBeNull();
    expect(screen.getByRole("radio", { name: "All 1" })).toBeChecked();
  });

  it("filters by the ?q= search and offers to clear it", () => {
    query = "invoices";
    const setListener = vi.fn();
    window.addEventListener(SEARCH_SET_EVENT, setListener);
    renderHome();

    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.queryByText("Chat")).toBeNull();

    query = "payroll";
    renderHome();
    expect(screen.getByText('No apps match "payroll".')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(setListener).toHaveBeenCalled();
    window.removeEventListener(SEARCH_SET_EVENT, setListener);
  });

  it("opens the first live match when the search is submitted", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    query = "a";
    renderHome();
    window.dispatchEvent(new Event(SEARCH_SUBMIT_EVENT));
    expect(open).toHaveBeenCalledWith("http://localhost:3001", "_blank", "noopener,noreferrer");
  });

  it("explains what to do when there are no apps", () => {
    renderHome({ apps: [] });
    expect(screen.getByRole("heading", { name: "No apps yet" })).toBeInTheDocument();
    expect(screen.getByText("Ask an admin to add you to your department.")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});
