import * as React from "react";

import { cn } from "@/lib/utils";

/** Fields: 40px, 8px radius, control border, 14px text. */
export const CONTROL =
  "w-full min-w-0 rounded-md border bg-white px-3 py-2 text-body-s text-ink " +
  "placeholder:text-faint transition-colors duration-150 " +
  "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-meta";

// Kept as a separate string: Tailwind resolves conflicting border-colour
// utilities by stylesheet order, not by the order they are written.
export const RULE = "border-hairline-strong hover:border-slate-400 focus:border-accent";

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
