import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent text-[rgba(200,172,251,0.55)]",
        className
      )}
      {...props}
    />
  )
}

export { Spinner }
