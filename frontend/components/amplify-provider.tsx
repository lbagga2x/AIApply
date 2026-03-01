"use client";
import { configureAmplify } from "@/lib/auth";

// Configure synchronously so Amplify is ready before any child useEffect runs.
// Safe here because "use client" guarantees browser-only execution.
configureAmplify();

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
