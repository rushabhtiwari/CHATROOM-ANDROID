import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Launcher } from "@/components/Launcher";
import type { MyApp } from "@/lib/types";

const base = { description: "", icon: "", logo_version: null, role: "member" } as const;
const APPS: MyApp[] = [
  {
    ...base,
    slug: "example",
    name: "Example App",
    category: "department",
    status: "active",
    launch_url: "http://localhost:3001",
    description: "Reference integration",
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
  {
    ...base,
    slug: "chat",
    name: "Chat",
    category: "company",
    status: "coming_soon",
    launch_url: "",
    logo_version: 1789000000,
  },
];

afterEach(() => vi.restoreAllMocks());

describe("Launcher", () => {
  it("shows live apps as links and coming-soon apps as disabled tiles", () => {
    render(<Launcher apps={APPS} firstName="Sam" />);

    const live = screen.getByRole("link", { name: /Example App/ });
    expect(live).toHaveAttribute("href", "http://localhost:3001");
    expect(live).toHaveAttribute("target", "_blank");
    expect(live).toHaveAttribute("title", "Reference integration");

    const soon = screen.getByText("Sales").closest("[aria-disabled]");
    expect(soon).toHaveAttribute("aria-disabled", "true");
    expect(soon).toHaveAttribute("title", "Orders and invoices. Coming soon.");
    expect(within(soon as HTMLElement).getByText("Soon")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Sales/ })).toBeNull();
  });

  it("uses the uploaded logo when there is one", () => {
    render(<Launcher apps={APPS} firstName="Sam" />);
    const tile = screen.getByText("Chat").closest("[aria-disabled]") as HTMLElement;
    expect(tile.querySelector("img")).toHaveAttribute("src", "/logos/chat?v=1789000000");
  });

  it("falls back to the icon if the logo can't load", () => {
    render(<Launcher apps={APPS} firstName="Sam" />);
    const tile = screen.getByText("Chat").closest("[aria-disabled]") as HTMLElement;
    fireEvent.error(tile.querySelector("img") as HTMLImageElement);
    expect(tile.querySelector("img")).toBeNull();
    expect(tile.querySelector("svg")).not.toBeNull();
  });

  it("groups apps and filters them as you type", () => {
    render(<Launcher apps={APPS} firstName="Sam" />);
    expect(screen.getByRole("heading", { name: "Departments" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Company tools" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Find an app" }), { target: { value: "invoices" } });

    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.queryByText("Chat")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Company tools" })).toBeNull();
  });

  it("says when nothing matches", () => {
    render(<Launcher apps={APPS} firstName="Sam" />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find an app" }), { target: { value: "payroll" } });
    expect(screen.getByText('No apps match "payroll".')).toBeInTheDocument();
  });

  it("opens the first live match when you press Enter", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<Launcher apps={APPS} firstName="Sam" />);
    const search = screen.getByRole("searchbox", { name: "Find an app" });

    fireEvent.change(search, { target: { value: "a" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(open).toHaveBeenCalledWith("http://localhost:3001", "_blank", "noopener,noreferrer");
  });

  it("focuses search when you press /", () => {
    render(<Launcher apps={APPS} firstName="Sam" />);
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByRole("searchbox", { name: "Find an app" })).toHaveFocus();
  });

  it("explains what to do when there are no apps", () => {
    render(<Launcher apps={[]} firstName="Nia" />);
    expect(
      screen.getByText("You don't have any apps yet. Ask an admin to add you to your department."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
