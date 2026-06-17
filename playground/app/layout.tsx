import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Tuna } from "@suryanewa/tuna";
import { siteUrl } from "./site-url";

const title = "Tuna - Visual edits your agents can ship";
const description =
  "Visual edits your agents can ship. Tuna lets you select UI elements, fine-tune their visual details, and instruct your agents directly from your browser. Make changes visually and ship them frictionlessly.";
const previewImage = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "Tuna - The visual layer for vibe coding",
};

export const metadata: Metadata = {
  title: "Tuna",
  description,
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    siteName: "Tuna",
    url: "/",
    type: "website",
    images: [previewImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [previewImage],
    creator: "@___sujan",
  },
  keywords: [
    "tuna",
    "vibe coding",
    "visual devtools",
    "AI coding",
    "CSS editor",
    "Codex",
    "Claude Code",
    "Cursor",
    "MCP",
    "developer tools",
    "Tailwind",
    "React",
    "Next.js",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var p=localStorage.getItem('theme')||'tuna';var t=p==='light'||p==='dark'||p==='tuna'?p:'tuna';document.documentElement.setAttribute('data-theme',t);window.__INITIAL_DARK__=t==='dark'})()`,
          }}
        />
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Tuna",
              description:
                "The visual layer for vibe coding. Select any element in your running app, tweak it visually, and let your AI coding tool write the changes to source.",
              url: siteUrl,
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              author: {
                "@type": "Person",
                name: "Sujan Khadgi",
                url: "https://x.com/___sujan",
              },
              license: "https://polyformproject.org/licenses/shield/1.0.0/",
            }),
          }}
        />
      </head>
      <body style={{ margin: 0 }}>
        {children}
        <Analytics />
        <Tuna force />
      </body>
    </html>
  );
}
