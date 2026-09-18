import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Controls — LEDGERDESIGNSYSTEM.md §5.3.
 *
 * Every control is held by a 2px border. That is the signature: it reads as a
 * machine control, not a web pill. Three details carry it:
 *
 *   1. The dark rim on the primary — `border-ink` around `bg-accent`. Without
 *      it the amber floats; with it, it is a pressed key.
 *   2. Hover is `brightness-95`, not a new colour. The palette never grows a
 *      "hover orange"; active is `brightness-90`.
 *   3. `active:translate-y-px` — a 1px press. There is no shadow, so the
 *      physicality has to come from displacement.
 *
 * There is deliberately no green variant. Green is a *status* ink (settled,
 * credited); one hue cannot simultaneously mean "press this" and "this is
 * done". The forward action is always `default`.
 */
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap border-2 font-sans font-semibold leading-none " +
    "cursor-pointer transition-all duration-150 active:translate-y-px " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 " +
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Accent fill with a dark rim around it. The rim is the control.
        default: "border-ink bg-accent text-accent-ink hover:brightness-95 active:brightness-90",
        destructive: "border-danger bg-danger text-white hover:brightness-95 active:brightness-90",
        outline:
          "border-hairline-strong bg-white text-ink hover:border-ink hover:bg-canvas active:bg-canvas-deep",
        secondary:
          "border-structure bg-structure text-white hover:bg-structure-600 active:bg-structure-700",
        ghost: "border-transparent bg-transparent text-ink hover:bg-canvas-deep",
        link: "border-transparent bg-transparent text-accent-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 gap-2 px-4 text-body-s",
        sm: "h-8 gap-1.5 px-3 text-body-s",
        lg: "h-12 gap-2.5 px-5 text-body",
        // Icon-only buttons take the same skeleton on a square footprint, and
        // always ship both `aria-label` and `title` (§8.6).
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
