import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Voice Reader",
  description: "Read PDF text aloud locally in your browser. Your document never leaves this tab.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
