import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin", "latin-ext"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: { default: "Platforma Gana", template: "%s · Platforma Gana" },
  description: "Portalul clienților Gana Finance & Accounting: documente, solicitări și raportări.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#0B1F3A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
