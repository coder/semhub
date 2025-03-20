import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const shineButtonVariants = cva(
  "group relative inline-flex items-center justify-center overflow-hidden rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700",
        gradient:
          "bg-gradient-to-r from-blue-500 to-orange-500 text-white hover:from-blue-600 hover:to-orange-600",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ShineButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof shineButtonVariants> {
  asChild?: boolean;
}

const ShineButton = React.forwardRef<HTMLButtonElement, ShineButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(shineButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        <div className="relative z-10 inline-flex items-center justify-center gap-2">
          {children}
        </div>
        <div className="absolute inset-0 -top-[20px] flex h-[calc(100%+40px)] w-full animate-shine-infinite justify-center blur-md">
          <div className="relative h-full w-8 bg-white/80" />
        </div>
      </Comp>
    );
  },
);
ShineButton.displayName = "ShineButton";

export { ShineButton, shineButtonVariants };
