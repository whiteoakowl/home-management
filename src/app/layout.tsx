import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/pwa/service-worker";
import { getBrand } from "@/lib/billing";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["SOFT", "opsz"] });

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return { ...baseMetadata, title: { default: brand, template: `%s · ${brand}` }, applicationName: brand, appleWebApp: { capable: true, title: brand, statusBarStyle: "default" } };
}

const baseMetadata: Metadata = {
  description: "Your family's home, organised in one place.",
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f3ef",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
