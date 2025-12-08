import * as React from "react";
import { cn } from "@/lib/utils";

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg";
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]",
          {
            "h-4 w-4": size === "sm",
            "h-5 w-5": size === "default",
            "h-8 w-8": size === "lg",
          },
          className,
        )}
        role="status"
        {...props}
      >
        <span className="sr-only">Loading...</span>
      </div>
    );
  },
);
Spinner.displayName = "Spinner";

export { Spinner };
