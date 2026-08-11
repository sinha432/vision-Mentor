import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useSignOut } from "@/hooks/use-sign-out";
import { getCompanyProfile } from "@/lib/assessments-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const signOut = useSignOut();
  const { data: company } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => getCompanyProfile(),
  });
  const companyName = company?.name ?? "Your Company";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar companyName={companyName} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-strong sticky top-0 z-20 flex h-14 items-center gap-3 px-3 sm:px-5">
            <SidebarTrigger />
            <span className="truncate font-display text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Company dashboard
            </span>
            <div className="ml-auto flex min-w-0 items-center gap-3">
              <span className="hidden truncate text-sm text-muted-foreground sm:block">
                {companyName}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Sign out"
                className="hover-glow rounded-full"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-3 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
