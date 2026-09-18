import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Fields carry a heavier bottom rule — LEDGERDESIGNSYSTEM.md §5.9. The
 * underline *is* the field; the box is just containment.
 *
 * The bottom rule is `meta` (5.6:1), not `hairline-strong` (2.1:1): a field
 * boundary is non-text content and must clear 3:1 under WCAG 1.4.11. Focus
 * deepens that rule to near-black rather than swapping in the accent — a
 * mid-tone accent at ~2.3:1 would make the focused field *harder* to find than
 * the resting one. The global 2px accent ring is what announces focus.
 */
export const CONTROL =
  "w-full min-w-0 border border-b-2 bg-white px-3 py-2 text-body-s text-ink " +
  "placeholder:text-meta transition-colors duration-150 " +
  "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-meta";

// Kept as a separate string: Tailwind resolves conflicting border-colour
// utilities by stylesheet order, not by the order they are written.
export const RULE =
  "border-hairline-strong border-b-meta hover:border-b-ink focus:border-b-ink " +
  "disabled:border-b-hairline";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // Inputs whose content is a figure are set in the instrument voice.
    const isFigure = ["number", "tel", "date", "time", "month", "week"].includes(type ?? "");

    return (
      <input
        type={type}
        className={cn(CONTROL, RULE, "h-10", isFigure && "ku-fig", className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
