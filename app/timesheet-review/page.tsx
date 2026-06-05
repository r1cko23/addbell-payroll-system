import { redirect } from "next/navigation";

/** Legacy route — Timesheet Review merged into Time Attendance. */
export default function TimesheetReviewRedirect({
  searchParams,
}: {
  searchParams?: { period_start?: string };
}) {
  const periodStart = searchParams?.period_start;
  redirect(
    periodStart
      ? `/timesheet?period_start=${encodeURIComponent(periodStart)}`
      : "/timesheet"
  );
}
