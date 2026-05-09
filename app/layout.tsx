import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import { Navigation } from "@/components/navigation";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});


export const metadata: Metadata = {
  title: "Andrew & Kayla | August 29, 2026",
  description:
    "We're getting married! Join us Saturday, August 29, 2026 at Belle Meade Mansion in Nashville, TN.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-body">
        <Navigation />
        <main className="flex-1">{children}</main>
        <footer className="py-8 text-center text-sm text-deep-sage">
          <p>Andrew & Kayla &middot; August 29, 2026 &middot; Nashville, TN</p>
        </footer>
      </body>
    </html>
  );
}
