import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-display" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

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
      <body className={`${inter.variable} ${manrope.variable} ${jetBrainsMono.variable}`}>{children}</body>
    </html>
  );
}