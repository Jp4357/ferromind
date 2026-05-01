import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FerroMind — Ferrochrome Intelligence System",
  description: "Process automation and inventory management for ferrochrome production",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
