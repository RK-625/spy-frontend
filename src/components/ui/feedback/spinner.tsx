import * as React from "react"

import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        // Spinner geometry is circular by nature (not a pill control exception).
        // Color from lavender token — avoid raw rgba invent.
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent text-lavender/55",
        className
      )}
      {...props}
    />
  )
}

export { Spinner }
