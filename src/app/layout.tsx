import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Milagres PMS",
  description: "Property Management System for Milagres Hospedagens",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
