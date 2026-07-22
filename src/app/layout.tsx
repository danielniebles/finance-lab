import type { Metadata, Viewport } from "next";
import { Sora, DM_Sans, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
