import { describe, expect, it } from "vitest";
import {
  dbAppBar,
  dbAppBarAvatarFallback,
  dbAppBarGhostButton,
  dbAppBarNavActive,
  dbAppBarNavIdle,
  dbAppBarOutlineButton,
  dbContentShell,
  dbFilterSelect,
  dbHeaderButton,
  dbStatusBadge,
} from "@/lib/dashboard-ui";

describe("dashboard content width", () => {
  it("uses the full row after the sidebar was removed, instead of a 7xl cap", () => {
    expect(dbContentShell).toContain("w-full");
    expect(dbContentShell).toContain("max-w-none");
    expect(dbContentShell).not.toContain("max-w-7xl");
    expect(dbContentShell).not.toContain("container");
  });
});

describe("dashboard top navbar chrome", () => {
  it("paints the bar with the retired sidebar navy, not the light card surface", () => {
    expect(dbAppBar).toContain("app-topbar");
    expect(dbAppBar).toContain("bg-sidebar");
    expect(dbAppBar).not.toContain("bg-card");
  });

  it("keeps avatar circle off the navy fill so initials stay readable", () => {
    expect(dbAppBarAvatarFallback).not.toContain("bg-primary");
    expect(dbAppBarAvatarFallback).toContain("bg-background");
    expect(dbAppBarAvatarFallback).toContain("text-primary");
  });

  it("keeps nav hover and click on navy, including the active Projects group", () => {
    for (const cls of [
      dbAppBarNavIdle,
      dbAppBarNavActive,
      dbAppBarGhostButton,
      dbAppBarOutlineButton,
    ]) {
      expect(cls).toContain("hover:bg-sidebar-active");
      expect(cls).not.toContain("hover:bg-muted");
      expect(cls).toContain("focus-visible:ring-offset-0");
      expect(cls).toContain("data-[state=open]:bg-sidebar-active");
    }
  });

  it("uses iOS capsule buttons with press scale, not a slow all-property transition", () => {
    expect(dbHeaderButton).toContain("rounded-full");
    expect(dbHeaderButton).toContain("min-h-11");
    expect(dbHeaderButton).toContain("active:scale-[0.97]");
    expect(dbHeaderButton).toContain("duration-press");
    expect(dbHeaderButton).toContain("ease-out-ui");
    expect(dbHeaderButton).not.toContain("transition-all");
    expect(dbHeaderButton).toContain("motion-reduce:active:scale-100");
    expect(dbFilterSelect).toContain("rounded-full");
    expect(dbAppBarNavIdle).toContain("active:scale-[0.97]");
    expect(dbStatusBadge).toContain("rounded-full");
  });
});
