import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90 shadow-sm",
        accent:
          "bg-brand-soft text-brand-on-soft hover:opacity-90 font-semibold",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent border border-border",
        outline:
          "border border-input bg-card text-foreground hover:bg-accent",
        ghost: "hover:bg-accent text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90",
      },
      // The small and icon sizes were drawn for a cursor. On touch they grow to a finger and
      // go back to their dense selves from lg, where there is a pointer.
      size: {
        default: "h-11 px-5 py-2 lg:h-10",
        sm: "h-10 rounded-full px-3 text-xs lg:h-8",
        lg: "h-11 rounded-full px-6",
        icon: "h-11 w-11 lg:h-10 lg:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
