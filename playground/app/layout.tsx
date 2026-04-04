import type { Metadata } from "next";
import { Retune } from "retune";
import "./globals.css";

export const metadata: Metadata = {
  title: "Retune Dev",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
        <Retune />
      </body>
    </html>
  );
}
