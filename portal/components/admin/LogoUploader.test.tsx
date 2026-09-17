import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LogoDropZone } from "@/components/admin/LogoUploader";

describe("LogoDropZone", () => {
  it("wraps a real file input and shows the chosen file", () => {
    render(<LogoDropZone />);
    const input = screen.getByLabelText(/Upload a logo/) as HTMLInputElement;
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("name", "logo");
    expect(input).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");

    const file = new File(["png"], "chat.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("chat.png")).toBeInTheDocument();
  });

  it("accepts a dropped file", () => {
    render(<LogoDropZone />);
    const zone = screen.getByText(/or drag it here/).closest("label") as HTMLElement;
    const file = new File(["png"], "dropped.png", { type: "image/png" });

    fireEvent.dragOver(zone, { dataTransfer: { files: [file], types: ["Files"] } });
    expect(zone).toHaveClass("is-dragging");
    fireEvent.drop(zone, { dataTransfer: { files: [file], types: ["Files"] } });

    expect(zone).not.toHaveClass("is-dragging");
    expect(screen.getByText("dropped.png")).toBeInTheDocument();
  });
});
