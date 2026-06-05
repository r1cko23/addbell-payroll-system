import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Add-bell Technical Services, Inc. - Project Management & Payroll System",
  description:
    "Construction project management system with payroll, time tracking, and cost management",
  icons: {
    icon: "/add-bell-logo-new.png",
    shortcut: "/add-bell-logo-new.png",
    apple: "/add-bell-logo-new.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${sourceSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
