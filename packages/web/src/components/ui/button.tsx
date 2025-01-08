import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary-dark dark:text-primary-dark-foreground dark:hover:bg-primary-dark/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive-dark dark:text-destructive-dark-foreground dark:hover:bg-destructive-dark/90",
        "destructive-ghost":
          "text-destructive hover:bg-destructive/10 dark:text-destructive-dark dark:hover:bg-destructive-dark/10",
        outline:
          "dark:border-input-dark dark:bg-background-dark border border-input bg-background hover:bg-slate-100/50 dark:hover:bg-slate-800/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-slate-100/50 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-slate-800/50",
        ghost: "hover:bg-slate-100/50 dark:hover:bg-slate-800/50",
        link: "text-primary underline-offset-4 hover:underline dark:text-primary-dark",
        authorize:
          "bg-authorize text-authorize-foreground hover:bg-authorize/90 hover:text-authorize-hover-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
