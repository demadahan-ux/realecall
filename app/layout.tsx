import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./brand-design.css";
import "./responsive.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: "RealeCall | Customer Support & Back-Office Assistance",
  description: "Reliable remote support for growing businesses. Explore call support, email and chat, appointment setting, and back-office assistance. Connect with RealeCall your way.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
