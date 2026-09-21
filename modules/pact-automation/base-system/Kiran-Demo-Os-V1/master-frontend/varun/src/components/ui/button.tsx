import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Controls - docs/design-language.md.
 *
 * One primary per screen area: accent blue, 44px, 15/600, 10px radius. Everything
 * else is a quiet white 36px button with a control border, or a ghost/icon button.
 */
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap border font-sans leading-none " +
    "cursor-pointer transition-colors duration-150 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent font-semibold text-white hover:bg-accent-hover",
        destructive: "border-transparent bg-danger font-semibold text-white hover:brightness-95",
        outline: "border-hairline-strong bg-white font-medium text-ink hover:bg-canvas",
        secondary: "border-hairline-strong bg-white font-medium text-ink hover:bg-canvas",
        ghost: "border-transparent bg-transparent font-medium text-ink hover:bg-black/5",
        link: "border-transparent bg-transparent font-medium text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-2 rounded-md px-3.5 text-body-s",
        sm: "h-8 gap-1.5 rounded-md px-3 text-caption",
        lg: "h-11 gap-2 rounded-[10px] px-5 text-[15px]",
        icon: "h-9 w-9 rounded-md p-0",
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
