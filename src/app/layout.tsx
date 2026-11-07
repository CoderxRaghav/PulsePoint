import type { Metadata } from "next";
import { Lora } from "next/font/google";
import "./globals.css";
import { AuthInitializer } from "@/components/auth/auth-initializer";

const lora = Lora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lora",
});

export const metadata: Metadata = {
  title: "PulsePoint — Student Teammate Discovery & Project Collaboration",
  description:
    "Discover complementary skills, form your team, find hackathons, and turn your next project into a shared achievement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark scroll-smooth ${lora.variable}`}>
      <body className="min-h-screen bg-space-black text-warm-white antialiased selection:bg-crimson/30 selection:text-white">
        <AuthInitializer />
        {children}
      </body>
    </html>
  );
}
