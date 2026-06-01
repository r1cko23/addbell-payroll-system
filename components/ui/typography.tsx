import { ReactNode, CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TypographyProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function H1({ children, className, style, ...props }: TypographyProps) {
  return (
    <h1
      className={cn("text-3xl font-bold tracking-tight", className)}
      style={style}
      {...props}
    >
      {children}
    </h1>
  );
}

/** Compact page heading (employee portal and similar views). Mobile-first sizing. */
export function PageTitle({ children, className, style, ...props }: TypographyProps) {
  return (
    <h1
      className={cn(
        "text-lg font-semibold leading-tight tracking-tight text-foreground sm:text-xl md:text-2xl",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </h1>
  );
}

export function H2({ children, className, style, ...props }: TypographyProps) {
  return (
    <h2
      className={cn("text-2xl font-semibold tracking-tight", className)}
      style={style}
      {...props}
    >
      {children}
    </h2>
  );
}

export function H3({ children, className, style, ...props }: TypographyProps) {
  return (
    <h3
      className={cn("text-lg font-semibold", className)}
      style={style}
      {...props}
    >
      {children}
    </h3>
  );
}

export function H4({ children, className, style, ...props }: TypographyProps) {
  return (
    <h4
      className={cn("text-base font-semibold", className)}
      style={style}
      {...props}
    >
      {children}
    </h4>
  );
}

export function Body({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <p
      className={cn("text-base text-foreground", className)}
      style={style}
      {...props}
    >
      {children}
    </p>
  );
}

export function BodySmall({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      style={style}
      {...props}
    >
      {children}
    </p>
  );
}

export function Label({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <label
      className={cn("text-sm font-medium", className)}
      style={style}
      {...props}
    >
      {children}
    </label>
  );
}

export function Caption({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <span
      className={cn("font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground", className)}
      style={style}
      {...props}
    >
      {children}
    </span>
  );
}

/** Section heading below page H1 (matches CardTitle weight/size). */
export function SectionHeading({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-snug tracking-tight text-foreground",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </h2>
  );
}

/** Large KPI on summary cards (employee portal, dashboards). */
export function StatValue({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <div
      className={cn(
        "text-3xl font-bold tabular-nums text-primary",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

/** Numeric KPI inside dashboard stat cards. */
export function KpiValue({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <div
      className={cn("stats-value tabular-nums text-foreground", className)}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}