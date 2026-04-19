import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Gmail Search Dashboard",
  description: "A personal Gmail search dashboard with advanced filters and analytics.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Apply the stored theme BEFORE React hydrates to avoid the flash of wrong theme.
  const themeScript = `
    (function(){
      try {
        var t = localStorage.getItem('theme');
        var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var useDark = t === 'dark' || (t !== 'light' && sysDark);
        if (useDark) document.documentElement.classList.add('dark');
      } catch(e){}
    })();
  `;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
