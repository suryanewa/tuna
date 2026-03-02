import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Composer",
  description: "Visual page composition editor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
