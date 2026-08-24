import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="outline"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="hover-glow gap-2 rounded-full"
    >
      {isDark ? (
        <Moon className="h-4 w-4 text-cyber" />
      ) : (
        <Sun className="h-4 w-4 text-amber" />
      )}
      <span className="text-sm">{isDark ? "Dark" : "Light"} mode</span>
    </Button>
  );
}
