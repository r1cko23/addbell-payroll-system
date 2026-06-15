import { cn } from "@/lib/utils";

export function FundRequestFieldLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h4
      className={cn(
        "text-xs font-semibold text-muted-foreground uppercase tracking-wide",
        className
      )}
    >
      {children}
    </h4>
  );
}

export function FundRequestField({
  label,
  value,
  className,
  uppercaseValue = true,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  uppercaseValue?: boolean;
}) {
  return (
    <div className={className}>
      <FundRequestFieldLabel>{label}</FundRequestFieldLabel>
      <p className={cn("mt-1", uppercaseValue && "uppercase")}>{value}</p>
    </div>
  );
}

export function formatFundRequestDisplayText(
  value: string | null | undefined
): string {
  if (value == null) return "—";
  const trimmed = value.trim();
  if (!trimmed) return "—";
  return trimmed.toUpperCase();
}
