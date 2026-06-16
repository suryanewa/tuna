import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Tuna } from "@suryanewa/tuna";

export const metadata: Metadata = {
  title: "Tuna",
  description:
    "Select any element in your running app, tweak it visually, and let your AI coding tool write the changes. The visual layer for vibe coding.",
  metadataBase: new URL("https://tuna.dev"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Tuna - The visual layer for vibe coding",
    description:
      "Select any element in your running app, tweak it visually, and let your AI coding tool write the changes to source.",
    siteName: "Tuna",
    url: "https://tuna.dev",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Tuna - The visual layer for vibe coding",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tuna - The visual layer for vibe coding",
    description:
      "Select any element in your running app, tweak it visually, and let your AI coding tool write the changes to source.",
    images: ["/opengraph-image.png"],
    creator: "@___sujan",
  },
  keywords: [
    "tuna",
    "vibe coding",
    "visual devtools",
    "AI coding",
    "CSS editor",
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
            __html: `(function(){var p=localStorage.getItem('theme')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');window.__INITIAL_DARK__=d})()`,
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
              url: "https://tuna.dev",
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
