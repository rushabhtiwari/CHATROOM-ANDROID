import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Segmented } from "@/components/ui/Segmented";

const OPTIONS = [
  { value: "all", label: "All", count: 14 },
  { value: "department", label: "Departments", count: 10 },
];

describe("Segmented", () => {
  it("is a labelled radio group that reports changes", () => {
    const onChange = vi.fn();
    render(<Segmented label="Show" options={OPTIONS} value="all" onChange={onChange} />);

    expect(screen.getByRole("radiogroup", { name: "Show" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All 14" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Departments 10" }));

    expect(onChange).toHaveBeenCalledWith("department");
  });

  it("works inside a form without a handler", () => {
    render(
      <form>
        <Segmented label="Status" name="status" options={OPTIONS} defaultValue="department" />
      </form>,
    );
    const departments = screen.getByRole("radio", { name: "Departments 10" });
    expect(departments).toBeChecked();
    expect(departments).toHaveAttribute("name", "status");
  });
});
