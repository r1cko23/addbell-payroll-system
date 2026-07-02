"use client";

import { parse } from "date-fns";
import { Button } from "@/components/ui/button";
import { epPeriodNavButton } from "@/lib/employee-portal-ui";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import {
  formatFundRequestCutoffPeriod,
  isFundRequestCutoffDeadlineRollForwardActive,
} from "@/lib/fund-request-cutoff";
import type { WeeklyCutoffPeriod } from "@/utils/weekly";

type FundRequestCutoffNavProps = {
  cutoffs: WeeklyCutoffPeriod[];
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  loading?: boolean;
};

export function FundRequestCutoffNav({
  cutoffs,
  selectedIndex,
  onSelectedIndexChange,
  loading = false,
}: FundRequestCutoffNavProps) {
  const selectedCutoff = cutoffs[selectedIndex] ?? null;
  if (cutoffs.length === 0 || !selectedCutoff) return null;

  const start = parse(selectedCutoff.start_ymd, "yyyy-MM-dd", new Date());
  const end = parse(selectedCutoff.end_ymd, "yyyy-MM-dd", new Date());
  const cutoffNavLabel = formatFundRequestCutoffPeriod(start, end);
  const canGoToOlderCutoff = selectedIndex < cutoffs.length - 1;
  const canGoToNewerCutoff = selectedIndex > 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 rounded-lg border bg-card px-2 py-2 sm:px-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={epPeriodNavButton}
          disabled={!canGoToOlderCutoff || loading}
          onClick={() =>
            onSelectedIndexChange(Math.min(selectedIndex + 1, cutoffs.length - 1))
          }
          aria-label="Previous cutoff"
        >
          <Icon name="CaretLeft" size={IconSizes.sm} />
        </Button>
        <p className="min-w-0 flex-1 text-center text-xs font-medium leading-tight text-foreground sm:text-sm">
          {cutoffNavLabel}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={epPeriodNavButton}
          disabled={!canGoToNewerCutoff || loading}
          onClick={() => onSelectedIndexChange(Math.max(selectedIndex - 1, 0))}
          aria-label="Next cutoff"
        >
          <Icon name="CaretRight" size={IconSizes.sm} />
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Cutoff period: Friday – Thursday
        {isFundRequestCutoffDeadlineRollForwardActive() ? ", 10:00 AM Manila" : null}
      </p>
    </div>
  );
}
