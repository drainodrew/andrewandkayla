import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Navigation } from "@/components/navigation";
import { LanguageProvider } from "@/lib/i18n";
import { Footer } from "@/components/footer";
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
  openGraph: {
    title: "Andrew & Kayla | August 29, 2026",
    description:
      "We're getting married! Join us Saturday, August 29, 2026 at Belle Meade Mansion in Nashville, TN.",
    images: [{ url: "/images/og-image.jpg", width: 1024, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Andrew & Kayla | August 29, 2026",
    description:
      "We're getting married! Join us Saturday, August 29, 2026 at Belle Meade Mansion in Nashville, TN.",
    images: ["/images/og-image.jpg"],
  },
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
        <LanguageProvider>
          {/* Site chrome is screen furniture. Printing any page (the seating
              chart, the schedule) should give you the content, not a nav bar
              and a footer stamped onto every sheet. The nav also carries a
              border-b, which is what read as a stray line across the top of
              the printed seating chart. */}
          <div className="print:hidden">
            <Navigation />
          </div>
          <main className="flex-1">{children}</main>
          <div className="print:hidden">
            <Footer />
          </div>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
