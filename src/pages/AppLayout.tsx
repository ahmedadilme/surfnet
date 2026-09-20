import { useQuery } from "@tanstack/react-query";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { api } from "@/lib/api.ts";
import {
  LayoutDashboard,
  Users,
  Package,
  Zap,
  CreditCard,
  Receipt,
  Wifi,
  Settings,
  Shield,
  FileText,
  FilePlus2,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useSettings } from "@/hooks/use-settings.ts";
import { ThemeToggle } from "@/components/theme-toggle.tsx";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/recharge", label: "Recharge", icon: Zap },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/quotations", label: "Quotations", icon: FilePlus2 },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/packages", label: "Packages", icon: Package },
];

export default function AppLayout() {
  const location = useLocation();
  const settings = useSettings();
  const { data: role } = useQuery({
    queryKey: ["auth", "current-role"],
    queryFn: () => api.get("/auth/current-role"),
  });
  const isAdmin = role === "admin";

  const isSettingsActive = location.pathname.startsWith("/settings");
  const isAdminActive = location.pathname.startsWith("/admin");

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Wifi className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">{settings.ispName}</p>
            <p className="text-xs text-sidebar-foreground/60">{settings.ispTagline}</p>
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
            const isActive = exact
              ? location.pathname === to
              : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            );
          })}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                isAdminActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Shield className="w-4 h-4" />
              Admin
            </NavLink>
          )}
        </nav>

        {/* Settings pinned to bottom */}
        {isAdmin && (
          <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
            <NavLink
              to="/settings"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                isSettingsActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Settings className="w-4 h-4" />
              Settings
            </NavLink>
          </div>
        )}
        <div className="px-3 pb-4 flex items-center justify-between border-t border-sidebar-border pt-3">
          <span className="text-xs text-sidebar-foreground/50">Theme</span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="fixed bottom-0 left-0 right-0 flex justify-between overflow-x-auto border-t bg-sidebar text-sidebar-foreground md:hidden z-50">
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
          const isActive = exact
            ? location.pathname === to
            : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs cursor-pointer transition-colors shrink-0",
                isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
              )}
            >
              <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              {label}
            </NavLink>
          );
        })}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs cursor-pointer transition-colors shrink-0",
              isAdminActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
            )}
          >
            <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            Admin
          </NavLink>
        )}
        {isAdmin && (
          <NavLink
            to="/settings"
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs cursor-pointer transition-colors shrink-0",
              isSettingsActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
            )}
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            Settings
          </NavLink>
        )}
        <div className="flex flex-col items-center gap-0.5 px-2 sm:px-3 py-1.5 shrink-0">
          <ThemeToggle />
        </div>
      </nav>
    </div>
  );
}
