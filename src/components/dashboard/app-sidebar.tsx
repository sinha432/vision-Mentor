import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, Users, Settings, UserCircle } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { CompanyNovaActions } from "@/components/nova/CompanyNovaActions";
import { useCompanyNovaActions } from "@/components/nova/CompanyNovaActionsContext";
import { BrandLogo } from "@/components/shared/BrandLogo";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, exact: true },
  {
    title: "Assessments",
    url: "/dashboard/assessments",
    icon: ClipboardList,
    exact: false,
  },
  { title: "Candidates", url: "/dashboard/candidates", icon: Users, exact: true },
  { title: "Profile", url: "/dashboard/profile", icon: UserCircle, exact: true },
  { title: "Settings", url: "/dashboard/settings", icon: Settings, exact: true },
];

export function AppSidebar({ companyName }: { companyName: string }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { dispatchAction } = useCompanyNovaActions();
  const pathname = useRouterState({
    select: (router) => router.location.pathname,
  });

  const isActive = (url: string, exact: boolean) =>
    exact ? pathname === url : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex min-w-0 items-center gap-3 px-1 py-2">
          <BrandLogo className="size-9 rounded-xl" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold">{companyName}</p>
              <p className="truncate text-xs text-muted-foreground">Company dashboard</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url, item.exact)}
                    tooltip={item.title}
                  >
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <div className="mt-4 border-t border-sidebar-border pt-3">
              <CompanyNovaActions
                collapsed={collapsed}
                onAction={(action) => {
                  const handled = dispatchAction(action);

                  if (!handled) {
                    void navigate({ to: "/dashboard" });
                  }

                  if (isMobile) {
                    setOpenMobile(false);
                  }
                }}
              />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
