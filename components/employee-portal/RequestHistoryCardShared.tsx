import { Badge } from "@/components/ui/badge";

export function RequestHistoryCategoryBadges({
  categoryLabel,
  subtitle,
  className,
}: {
  categoryLabel: string;
  subtitle?: string | null;
  className: string;
}) {
  return (
    <>
      <Badge variant="outline" className={className}>
        {categoryLabel}
      </Badge>
      {subtitle ? (
        <Badge variant="outline" className={className}>
          {subtitle}
        </Badge>
      ) : null}
    </>
  );
}
