import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppMark } from "@/components/AppMark";

describe("AppMark", () => {
  it("draws a gradient tile with the app's icon at the requested size", () => {
    const { container } = render(<AppMark slug="dispatch" icon="truck" logoVersion={null} size="lg" />);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile).toHaveClass("app-mark", "app-mark-lg");
    expect(tile.style.getPropertyValue("--from")).toMatch(/^#/);
    expect(tile.querySelector("svg")).not.toBeNull();
  });

  it("shows the logo when there is one and falls back to the icon if it fails", () => {
    const { container } = render(<AppMark slug="chat" icon="message-circle" logoVersion={1789000000} />);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile).toHaveClass("app-mark-logo");
    const img = tile.querySelector("img") as HTMLImageElement;
    expect(img).toHaveAttribute("src", "/logos/chat?v=1789000000");

    fireEvent.error(img);

    expect(tile.querySelector("img")).toBeNull();
    expect(tile).not.toHaveClass("app-mark-logo");
    expect(tile.querySelector("svg")).not.toBeNull();
  });
});
