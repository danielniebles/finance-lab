import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import "./globals.css";

// Self-hosted (src/app/fonts) rather than next/font/google: the Google
// variant downloads the files at build time, and a failed download broke the
// Vercel build. Variable fonts, so one file covers every weight we use.
const sora = localFont({
  src: "./fonts/sora-latin-wght.woff2",
  variable: "--font-sora",
  weight: "100 800",
  display: "swap",
});

const dmSans = localFont({
  src: "./fonts/dm-sans-latin-wght.woff2",
  variable: "--font-dm-sans",
  weight: "100 1000",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin-wght.woff2",
  variable: "--font-jetbrains-mono",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finance Lab",
  description: "Personal finance tracker",
  appleWebApp: {
    capable: true,
    title: "Finance Lab",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a2030",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value === "light" ? "light" : "dark";
  // Deployment-level "skin" choice, not a per-user preference — unlike the
  // light/dark cookie above, this never needs a runtime toggle, so a plain
  // server-only env var read once here is enough. Left unset, this is a no-op.
  const family = process.env.THEME_FAMILY === "signal" ? "signal" : "";

  return (
    <html
      lang="en"
      className={`${theme} ${family} ${sora.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
