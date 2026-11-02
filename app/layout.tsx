import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "valythm",
  description: "Capture a moment. Add another. Make an infinite audio loop.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
