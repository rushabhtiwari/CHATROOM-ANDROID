import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { APP_ICON_NAMES, AppIcon, DEFAULT_ICON } from "@/lib/icons";

describe("AppIcon", () => {
  it("offers the curated icon set", () => {
    expect(APP_ICON_NAMES).toHaveLength(30);
    expect(APP_ICON_NAMES).toContain("truck");
    expect(APP_ICON_NAMES).toContain(DEFAULT_ICON);
  });

  it("draws every curated icon as an SVG", () => {
    for (const name of APP_ICON_NAMES) {
      const { container, unmount } = render(<AppIcon name={name} />);
      expect(container.querySelector("svg"), name).not.toBeNull();
      unmount();
    }
  });

  it("falls back to the default icon for unknown or empty names", () => {
    const unknown = render(<AppIcon name="not-an-icon" />).container.innerHTML;
    const empty = render(<AppIcon name="" />).container.innerHTML;
    const fallback = render(<AppIcon name={DEFAULT_ICON} />).container.innerHTML;
    expect(unknown).toBe(fallback);
    expect(empty).toBe(fallback);
  });
});
