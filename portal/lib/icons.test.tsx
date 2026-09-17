import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { APP_ICON_NAMES, AppIcon, DEFAULT_ICON } from "@/lib/icons";

describe("AppIcon", () => {
  it("keeps the 30 stored icon names", () => {
    expect(APP_ICON_NAMES).toHaveLength(30);
    expect(APP_ICON_NAMES).toEqual(expect.arrayContaining(["truck", "message-circle", "trending-up", DEFAULT_ICON]));
  });

  it("draws every stored name as a duotone Phosphor icon", () => {
    for (const name of APP_ICON_NAMES) {
      const { container, unmount } = render(<AppIcon name={name} />);
      const svg = container.querySelector("svg");
      expect(svg, name).not.toBeNull();
      // Duotone icons include a translucent backdrop path.
      expect(container.querySelector("[opacity]"), name).not.toBeNull();
      unmount();
    }
  });

  it("falls back to the default icon for unknown or empty names", () => {
    const fallback = render(<AppIcon name={DEFAULT_ICON} />).container.innerHTML;
    expect(render(<AppIcon name="not-an-icon" />).container.innerHTML).toBe(fallback);
    expect(render(<AppIcon name="" />).container.innerHTML).toBe(fallback);
  });
});
