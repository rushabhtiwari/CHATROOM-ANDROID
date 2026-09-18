import * as React from "react";

import { cn } from "@/lib/utils";
import { CONTROL, RULE } from "./input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(CONTROL, RULE, "min-h-[72px] leading-6", className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
