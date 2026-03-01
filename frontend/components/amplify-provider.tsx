"use client";
import { useEffect } from "react";
import { configureAmplify } from "@/lib/auth";

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    configureAmplify();
  }, []);
  return <>{children}</>;
}
