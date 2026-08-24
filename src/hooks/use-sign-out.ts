import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { useDemoAuth } from "@/contexts/DemoAuthContext";

/**
 * Single sign-out action shared by the dashboard topbar and Settings.
 * Wired to the app's real auth context.
 */
export function useSignOut() {
  const router = useRouter();
  const { signOut } = useDemoAuth();

  return useCallback(() => {
    signOut();
    void router.navigate({ to: "/welcome" });
  }, [signOut, router]);
}
