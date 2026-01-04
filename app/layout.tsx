import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Green Pasture People Management Inc. - Payroll System",
  description:
    "Complete payroll management system with bi-monthly timesheet tracking",
  icons: {
    icon: "/GP_favicon.webp",
    shortcut: "/GP_favicon.webp",
    apple: "/GP_favicon.webp",
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