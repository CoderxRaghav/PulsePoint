import type { Metadata } from "next";
import { Lora } from "next/font/google";
import "./globals.css";
import { AuthInitializer } from "@/components/auth/auth-initializer";
import { ThemeProvider } from "@/components/ui/theme-provider";

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
    <html lang="en" className={`scroll-smooth ${lora.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("pulsepoint-theme");if(t!=="dark"&&t!=="light"){t=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light"}document.documentElement.dataset.theme=t;document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.style.colorScheme=t}catch(e){document.documentElement.dataset.theme="light";document.documentElement.style.colorScheme="light"}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-space-black text-warm-white antialiased selection:bg-crimson/30 selection:text-white">
        <ThemeProvider>
          <AuthInitializer />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
