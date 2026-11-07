"use client";

import { useEffect } from "react";
import { initializeAuth } from "@/lib/firebase";

/** Runs once at client startup so redirect OAuth is resolved before routing. */
export function AuthInitializer() {
  useEffect(() => {
    void initializeAuth().catch(() => {
      // Auth pages display actionable provider errors when a user starts a flow.
    });
  }, []);

  return null;
}
