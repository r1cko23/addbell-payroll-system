"use client";

import Link from "next/link";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { BodySmall } from "@/components/ui/typography";
import {
  EpDesktopView,
  EpMobileView,
} from "@/components/employee-portal/EmployeePortalViewport";
import {
  epCardInteractive,
  epPageStack,
  epQuickLinkCard,
  epQuickLinkCardContent,
  epQuickLinkIcon,
} from "@/lib/employee-portal-ui";
import { formatProfileDisplayName } from "@/lib/format-profile-display-name";
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
    title: "Bundy Clock",
    description: "Clock in and out, view your times.",
    icon: "Clock",
  },
  {
    href: "/employee-portal/leave-request",
    title: "Leave Request",
    description: "Request and track leave.",
    icon: "CalendarBlank",
  },
  {
    href: "/employee-portal/overtime",
    title: "OT Filing",
    description: "File OT for approval.",
    icon: "ClockClockwise",
  },
  {
    href: "/employee-portal/failure-to-log",
    title: "Failure To Log",
    description: "Submit missed punch requests.",
    icon: "WarningCircle",
  },
  {
    href: "/employee-portal/fund-request",
    title: "Fund Request",
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
    href: "/employee-portal/project-time",
    title: "Project Assignments",
    description: "View assigned projects and time.",
    icon: "Buildings",
  },
  {
    href: "/employee-portal/info",
    title: "My Information",
    description: "Profile and employment details.",
    icon: "User",
  },
];

function QuickLinkCard({
  item,
  variant,
}: {
  item: QuickLink;
  variant: "mobile" | "desktop";
}) {
  const isMobile = variant === "mobile";

  return (
    <Link
      href={item.href}
      className={cn(
        "group block outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
        isMobile ? "rounded-lg" : "rounded-xl"
      )}
    >
      <Card
        className={cn(
          "h-full",
          epQuickLinkCard,
          epCardInteractive,
          "group-focus-visible:shadow-md motion-safe:md:group-hover:shadow-md"
        )}
      >
        <CardContent className={epQuickLinkCardContent}>
          <div className={epQuickLinkIcon}>
            <Icon name={item.icon} size={IconSizes.md} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "font-semibold leading-snug text-foreground group-hover:text-primary",
                isMobile ? "text-sm" : "text-base"
              )}
            >
              {item.title}
            </p>
            <BodySmall
              className={cn(
                "mt-0.5 line-clamp-2 leading-snug text-muted-foreground",
                isMobile ? "text-xs" : "text-sm"
              )}
            >
              {item.description}
            </BodySmall>
          </div>
          {!isMobile ? (
            <Icon
              name="CaretRight"
              size={IconSizes.sm}
              className="mt-0.5 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
            />
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function EmployeePortalHomePage() {
  const { employee } = useEmployeeSession();
  const displayName = formatProfileDisplayName(employee.full_name);
  const firstName = displayName.split(" ")[0] || displayName;

  return (
    <div className={cn("w-full pb-2 md:pb-4", epPageStack)}>
      <EpMobileView className="gap-2">
        <PortalPageHeader
          title="Home"
          description={
            firstName
              ? `Welcome, ${firstName}. Choose a task below.`
              : "Choose a task below."
          }
          className="border-b-0 pb-1"
        />
        <div className="grid w-full gap-2">
          {QUICK_LINKS.map((item) => (
            <QuickLinkCard key={item.href} item={item} variant="mobile" />
          ))}
        </div>
      </EpMobileView>

      <EpDesktopView className="gap-4">
        <PortalPageHeader
          title="Home"
          description={
            displayName
              ? `Welcome back, ${displayName}. Choose a task below or use the menu.`
              : "Choose a task below or use the menu."
          }
          className="border-b border-border/70 pb-3"
        />
        <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-3">
          {QUICK_LINKS.map((item) => (
            <QuickLinkCard key={item.href} item={item} variant="desktop" />
          ))}
        </div>
      </EpDesktopView>
    </div>
  );
}
