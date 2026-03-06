import type { Metadata } from "next";
import { DevOverlay } from "@composer/overlay";

export const metadata: Metadata = {
  title: "Composer Demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
        {children}
        <DevOverlay />
      </body>
    </html>
  );
}
