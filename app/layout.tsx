import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quietmark — Share with context",
  description: "Add subtle, repeated watermarks to images before sharing them. Files stay in your browser.",
};

const themeInitScript = `(function(){try{var saved=localStorage.getItem('quietmark-theme');var theme=saved==='dark'||saved==='light'?saved:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeInitScript }}/></head><body>{children}</body></html>;
}
