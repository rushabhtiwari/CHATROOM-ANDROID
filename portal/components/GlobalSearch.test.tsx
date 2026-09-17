import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalSearch, SEARCH_SUBMIT_EVENT } from "@/components/GlobalSearch";

const push = vi.fn();
let pathname = "/";
let query = "";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(query ? { q: query } : {}),
}));

beforeEach(() => {
  push.mockReset();
  pathname = "/";
  query = "";
  window.history.replaceState(null, "", "/");
});

afterEach(() => vi.restoreAllMocks());

describe("GlobalSearch", () => {
  it("keeps the home page's ?q= in step with what you type", () => {
    render(<GlobalSearch />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search apps" }), { target: { value: "chat" } });
    expect(window.location.search).toBe("?q=chat");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search apps" }), { target: { value: "" } });
    expect(window.location.search).toBe("");
  });

  it("asks the home page to open the first match on Enter", () => {
    const listener = vi.fn();
    window.addEventListener(SEARCH_SUBMIT_EVENT, listener);
    render(<GlobalSearch />);

    fireEvent.submit(screen.getByRole("search"));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    window.removeEventListener(SEARCH_SUBMIT_EVENT, listener);
  });

  it("goes to the filtered home page from other pages", () => {
    pathname = "/admin/apps";
    render(<GlobalSearch />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search apps" }), { target: { value: "dispatch" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(push).toHaveBeenCalledWith("/?q=dispatch");
  });

  it("starts from the current ?q= and focuses on / or Ctrl+K", () => {
    query = "hr";
    render(<GlobalSearch />);
    const box = screen.getByRole("searchbox", { name: "Search apps" });
    expect(box).toHaveValue("hr");

    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    expect(box).toHaveFocus();
    box.blur();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(box).toHaveFocus();
  });
});
