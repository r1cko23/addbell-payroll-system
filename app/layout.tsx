import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Addbell Technical Services, Inc. - Project Management & Payroll System",
  description:
    "Construction project management system with payroll, time tracking, and cost management",
  icons: {
    icon: "/addbell-logo.jpg",
    shortcut: "/addbell-logo.jpg",
    apple: "/addbell-logo.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}