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

/** iOS Safari adds padding outside width:100% on date/time inputs (WebKit #301648). */
const TEMPORAL_INPUT_TYPES = new Set([
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
])

const inputBaseClass =
  "box-border w-full min-w-0 max-w-full rounded-md border border-input bg-background text-sm font-normal leading-normal ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"

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

    const isTemporal = TEMPORAL_INPUT_TYPES.has(type)

    return (
      <input
        type={type}
        className={cn(
          inputBaseClass,
          isTemporal
            ? "ios-temporal-input min-h-11 px-3 py-2.5 sm:min-h-10 sm:py-2"
            : "flex h-10 px-3 py-2",
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