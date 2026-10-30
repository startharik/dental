import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Provider from "@/components/provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DentraAI | Dental Imaging Analysis",
  description:
    "Analyze dental radiographs and review AI-assisted findings in a clinical workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} min-h-screen font-sans bg-background text-foreground`}
      >
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
