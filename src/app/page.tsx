import React from "react";
import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { IntroLoader } from "@/components/landing/intro-loader";
import { ProductPreview } from "@/components/landing/product-preview";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";
import { AiPreview } from "@/components/landing/ai-preview";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export default function LandingPage() {
  return (
    <>
      {/* Skip to Content Link for Keyboard & Screen Reader Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-rose-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Branded Preloader (Session-cached & Accessible) */}
      <IntroLoader />

      {/* Floating Glass Header Navigation */}
      <SiteHeader />

      {/* Main Page Flow */}
      <main id="main-content" className="relative flex-1">
        <Hero />
        <ProductPreview />
        <HowItWorks />
        <Features />
        <AiPreview />
        <FinalCta />
      </main>

      {/* Comprehensive Site Footer */}
      <SiteFooter />
    </>
  );
}
