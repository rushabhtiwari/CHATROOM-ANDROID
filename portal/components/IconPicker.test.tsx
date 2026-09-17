import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IconPicker } from "@/components/IconPicker";
import { APP_ICON_NAMES } from "@/lib/icons";

describe("IconPicker", () => {
  it("offers every curated icon as a named radio with the current one selected", () => {
    render(<IconPicker defaultValue="truck" />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(APP_ICON_NAMES.length);
    expect(screen.getByRole("radio", { name: "truck" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "truck" })).toHaveAttribute("name", "icon");
    expect(screen.getByRole("group", { name: "Icon" })).toBeInTheDocument();
  });

  it("selects the default icon when the app has none", () => {
    render(<IconPicker defaultValue="" />);
    expect(screen.getByRole("radio", { name: "app-window" })).toBeChecked();
  });
});
