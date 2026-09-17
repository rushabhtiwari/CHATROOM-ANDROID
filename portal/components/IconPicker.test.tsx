import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IconPicker } from "@/components/IconPicker";
import { APP_ICON_NAMES } from "@/lib/icons";

describe("IconPicker", () => {
  it("offers every icon as a named radio in a labelled group, with the current one selected", () => {
    render(<IconPicker defaultValue="truck" />);
    expect(screen.getByRole("radiogroup", { name: "Icon" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(APP_ICON_NAMES.length);
    const truck = screen.getByRole("radio", { name: "truck" });
    expect(truck).toBeChecked();
    expect(truck).toHaveAttribute("name", "icon");
    expect(truck.closest("label")?.querySelector("svg")).not.toBeNull();
  });

  it("selects the default icon when the app has none", () => {
    render(<IconPicker defaultValue="" />);
    expect(screen.getByRole("radio", { name: "app-window" })).toBeChecked();
  });
});
