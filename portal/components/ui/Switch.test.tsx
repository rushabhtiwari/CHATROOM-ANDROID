import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Switch } from "@/components/ui/Switch";

describe("Switch", () => {
  it("toggles and exposes its state", () => {
    const onChange = vi.fn();
    const { rerender } = render(<Switch label="Live only" checked={false} onChange={onChange} />);
    const control = screen.getByRole("switch", { name: "Live only" });
    expect(control).toHaveAttribute("aria-checked", "false");

    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(<Switch label="Live only" checked onChange={onChange} />);
    expect(control).toHaveAttribute("aria-checked", "true");
  });
});
