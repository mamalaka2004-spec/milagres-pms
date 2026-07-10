import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SwRegister } from "@/components/pwa/sw-register";

export const metadata: Metadata = {
  title: "Milagres PMS",
  description: "Property Management System for Milagres Hospedagens",
  applicationName: "Milagres PMS",
  appleWebApp: {
    capable: true,
    title: "Milagres",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#6B7F5E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
