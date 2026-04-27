import * as React from "react";

import { cn, toTitleCaseWords } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  autoCapitalizeWords?: boolean;
};

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  TextareaProps
>(({ className, autoCapitalizeWords = true, onChange, ...props }, ref) => {
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nativeEvent = event.nativeEvent as Event & { isComposing?: boolean };
    if (nativeEvent.isComposing) {
      onChange?.(event);
      return;
    }

    if (autoCapitalizeWords) {
      event.target.value = toTitleCaseWords(event.target.value);
    }

    onChange?.(event);
  };

  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-xl border border-input bg-background/70 px-4 py-3 text-sm text-foreground shadow-sm ring-offset-background transition-all duration-200 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
      onChange={handleChange}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };