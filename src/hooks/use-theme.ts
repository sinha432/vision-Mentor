import { useTheme as useRealTheme } from "@/contexts/ThemeContext";

export type Theme = "dark" | "light";

/**
 * Thin adapter over the app's real ThemeContext, reshaped to the
 * { theme, toggleTheme } contract the dashboard's ThemeToggle expects.
 * Uses `resolved` (always "light" | "dark", never "system") so the
 * toggle always shows a concrete state.
 */
export function useTheme() {
  const { resolved, toggle } = useRealTheme();
  return { theme: resolved as Theme, toggleTheme: toggle };
}
