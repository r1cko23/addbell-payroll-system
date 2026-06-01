"use client";

import Link from "next/link";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { BodySmall } from "@/components/ui/typography";
import { epCardInteractive, epPageStack } from "@/lib/employee-portal-ui";
import { cn } from "@/lib/utils";

type QuickLink = {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Icon>["name"];
};

const QUICK_LINKS: QuickLink[] = [
  {
    href: "/employee-portal/bundy",
    title: "Bundy clock",
    description: "Clock in and out, view your times.",
    icon: "Clock",
  },
  {
    href: "/employee-portal/leave-request",
    title: "Leave",
    description: "Request and track leave.",
    icon: "CalendarBlank",
  },
  {
    href: "/employee-portal/overtime",
    title: "Overtime",
    description: "File OT for approval.",
    icon: "ClockClockwise",
  },
  {
    href: "/employee-portal/failure-to-log",
    title: "Failure to log",
    description: "Submit missed punch requests.",
    icon: "WarningCircle",
  },
  {
    href: "/employee-portal/fund-request",
    title: "Fund request",
    description: "Submit and track fund requests.",
    icon: "Receipt",
  },
  {
    href: "/employee-portal/payslips",
    title: "Payslips",
    description: "View and download payslips.",
    icon: "FileText",
  },
  {
    href: "/employee-portal/info",
    title: "My information",
    description: "Profile and employment details.",
    icon: "User",
  },
  {
    href: "/employee-portal/project-time",
    title: "Project assignments",
    description: "View assigned projects and time.",
    icon: "Buildings",
  },
];

export default function EmployeePortalHomePage() {
  const { employee } = useEmployeeSession();

  return (
    <div className={cn("w-full pb-4", epPageStack)}>
      <PortalPageHeader
        title="Home"
        description={`Welcome back, ${employee.full_name}. Choose a task below or use the menu.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group block rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card
              className={cn(
                "h-full border-border/80 bg-card",
                epCardInteractive,
                "group-focus-visible:shadow-md motion-safe:md:group-hover:shadow-md"
              )}
            >
              <CardContent className="flex min-h-[72px] gap-3 p-4 sm:min-h-0 sm:p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name={item.icon} size={IconSizes.md} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground group-hover:text-primary">
                    {item.title}
                  </p>
                  <BodySmall className="mt-0.5 text-muted-foreground">
                    {item.description}
                  </BodySmall>
                </div>
                <Icon
                  name="CaretRight"
                  size={IconSizes.sm}
                  className="mt-1 shrink-0 text-muted-foreground motion-safe:md:transition-transform motion-safe:md:group-hover:translate-x-0.5"
                />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
