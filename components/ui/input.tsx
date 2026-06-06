import * as React from "react"

import { cn, toTitleCaseWords } from "@/lib/utils"

type InputProps = React.ComponentProps<"input"> & {
  autoCapitalizeWords?: boolean
}

const SKIPPED_CAPITALIZE_TYPES = new Set([
  "email",
  "password",
  "url",
  "number",
  "tel",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
  "search",
])

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", autoCapitalizeWords = false, onChange, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const nativeEvent = event.nativeEvent as Event & { isComposing?: boolean }
      if (nativeEvent.isComposing) {
        onChange?.(event)
        return
      }

      if (autoCapitalizeWords && !SKIPPED_CAPITALIZE_TYPES.has(type)) {
        event.target.value = toTitleCaseWords(event.target.value)
      }

      onChange?.(event)
    }

    return (
      <input
        type={type}
        className={cn(
          "box-border flex h-10 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal leading-normal ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
        onChange={handleChange}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }