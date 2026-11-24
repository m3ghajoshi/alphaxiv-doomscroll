import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "alphaXiv Scroll",
  description:
    "Swipe through video explainers of the papers trending on alphaXiv, TikTok-style.",
  applicationName: "alphaXiv Scroll",
  appleWebApp: { capable: true, title: "alphaXiv Scroll", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
