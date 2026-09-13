import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hobbyCronRunsPerDay,
  isVercelHobbyCronSchedule,
  vercelHobbyIncompatibleCrons,
  type VercelCronEntry,
} from "@/lib/vercel-hobby-cron";

describe("Vercel Hobby cron schedules", () => {
  it("rejects the hourly sheet-pull expression that fails Hobby deploys", () => {
    expect(isVercelHobbyCronSchedule("0 * * * *")).toBe(false);
    expect(hobbyCronRunsPerDay("0 * * * *")).toBe(24);
  });

  it("rejects other more-than-once-per-day expressions", () => {
    expect(isVercelHobbyCronSchedule("*/30 * * * *")).toBe(false);
    expect(isVercelHobbyCronSchedule("0 0,12 * * *")).toBe(false);
    expect(isVercelHobbyCronSchedule("*/5 2 * * *")).toBe(false);
  });

  it("allows the existing daily and weekly fund-request jobs", () => {
    expect(isVercelHobbyCronSchedule("10 16 * * *")).toBe(true);
    expect(isVercelHobbyCronSchedule("0 2 * * 4")).toBe(true);
  });

  it("treats zero crons as compatible and flags many when any is hourly", () => {
    expect(vercelHobbyIncompatibleCrons([])).toEqual([]);
    expect(
      vercelHobbyIncompatibleCrons([
        { path: "/api/once", schedule: "0 17 * * *" },
      ])
    ).toEqual([]);
    const many: VercelCronEntry[] = [
      { path: "/api/a", schedule: "0 2 * * 4" },
      { path: "/api/b", schedule: "10 16 * * *" },
      { path: "/api/c", schedule: "0 * * * *" },
    ];
    expect(vercelHobbyIncompatibleCrons(many)).toEqual([
      {
        path: "/api/c",
        schedule: "0 * * * *",
        reason:
          "Hobby accounts are limited to daily cron jobs. This cron expression would run more than once per day.",
      },
    ]);
  });

  it("keeps every vercel.json cron at most once per day so Hobby deploys", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")
    ) as { crons: VercelCronEntry[] };

    expect(vercelHobbyIncompatibleCrons(config.crons ?? [])).toEqual([]);
  });
});
