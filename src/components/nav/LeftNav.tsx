import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Shield,
  Radio,
  Building2,
  Banknote,
  Truck,
  FileText,
  Settings,
  Sparkles,
  ChevronDown,
  ChevronRight,
  LogOut,
  User as UserIcon
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAVIGATION_ITEMS, type NavigationItem } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { usePost } from "@/hooks/usePost";
import useFetch from "@/hooks/useFetch";

const iconMap = {
  LayoutDashboard,
  Shield,
  Tower: Radio,
  Building2,
  Banknote,
  Sparkles,
  Truck,
  FileText,
  Settings,
};

export function LeftNav() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Fetch eligible invoice count for Capital badge
  const { data: capitalData } = useFetch<{ eligible_invoices_count: number }>(
    '/api/v1/dashboard/capital/',
    { refetchInterval: 60000 } // Refresh every minute
  );

  useEffect(() => {
    const loadUser = () => {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        setUser(JSON.parse(userStr));
      }
    };

    loadUser();
    window.addEventListener('storage', loadUser);
    return () => window.removeEventListener('storage', loadUser);
  }, []);

  const { mutate: logout } = usePost({
    onSuccess: () => {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      localStorage.removeItem('user');
      window.location.href = '/login';
    },
    onError: () => {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  });

  const handleLogout = () => {
    logout({ url: 'api/auth/logout/', data: {} });
  };

  // Safe router hook usage
  let location;
  try {
    location = useLocation();
  } catch {
    // Fallback if router context not available
    location = { pathname: '/' };
  }

  const currentPath = location.pathname;

  const isActive = (path: string) => {
    return currentPath === path;
  };

  const isParentPathActive = (path: string) => {
    if (path === '/') {
      return currentPath === '/';
    }
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  const isParentActive = (item: NavigationItem) => {
    if ('href' in item) return isParentPathActive(item.href);
    if ('children' in item) {
      return item.children.some((child) => isActive(child.href));
    }
    return false;
  };

  const getNavClassName = (path: string, isParent = false) => {
    const active = isParent ? isParentPathActive(path) : isActive(path);
    return cn(
      "w-full justify-start transition-smooth",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
      isParent && "font-medium"
    );
  };

  const getParentClassName = (item: NavigationItem) => {
    return cn(
      "w-full justify-start transition-smooth",
      isParentActive(item)
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
    );
  };

  const handleMenuClick = (itemId: string) => {
    setExpandedMenu(expandedMenu === itemId ? null : itemId);
  };

  return (
    <Sidebar className="border-r-0 bg-[#0F172A]" style={{ "--sidebar-width": "240px" } as React.CSSProperties}>
      <SidebarContent className="bg-[#0F172A]">
        {/* TruckWys Logo at Top */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src="/favicon.png"
              alt="TruckWys"
              className="w-8 h-8"
            />
            {!collapsed && (
              <span className="text-white font-semibold text-lg">TruckWys</span>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <SidebarGroup className="py-4 px-3">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {NAVIGATION_ITEMS.map((item) => {
                const IconComponent = iconMap[item.icon as keyof typeof iconMap];
                const hasChildren = 'children' in item;
                const isExpanded = expandedMenu === item.id;
                const isItemActive = isParentActive(item);

                const eligibleCount = item.id === 'capital' && capitalData?.eligible_invoices_count ? capitalData.eligible_invoices_count : 0;
                const showBadge = item.id === 'capital' && eligibleCount > 0;

                return (
                  <div key={item.id}>
                    <SidebarMenuItem>
                      {hasChildren ? (
                        <div
                          onClick={() => handleMenuClick(item.id)}
                          className={cn(
                            "flex items-center justify-between cursor-pointer rounded-md px-3 py-2.5 text-sm transition-all",
                            "border-l-3 border-transparent",
                            isItemActive
                              ? "bg-[#1E293B] text-white border-l-[#2563EB] border-l-3"
                              : "text-[#94A3B8] hover:bg-[#1E293B]/50 hover:text-white"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <IconComponent className="w-5 h-5 flex-shrink-0" />
                            {!collapsed && (
                              <span className="truncate flex-1">{item.label}</span>
                            )}
                          </div>
                          {!collapsed && (
                            isExpanded ? (
                              <ChevronDown className="w-4 h-4 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 flex-shrink-0" />
                            )
                          )}
                        </div>
                      ) : (
                        <SidebarMenuButton asChild className="h-auto p-0">
                          <NavLink
                            to={'href' in item ? item.href : '#'}
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm transition-all",
                              "border-l-3 border-transparent",
                              isActive('href' in item ? item.href : '#')
                                ? "bg-[#1E293B] text-white border-l-[#2563EB] border-l-3"
                                : "text-[#94A3B8] hover:bg-[#1E293B]/50 hover:text-white"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <IconComponent className="w-5 h-5 flex-shrink-0" />
                              {!collapsed && (
                                <span className="truncate">{item.label}</span>
                              )}
                            </div>
                            {!collapsed && showBadge && (
                              <span className="flex items-center justify-center w-5 h-5 bg-[#2563EB] text-white text-xs font-bold rounded-full">
                                {eligibleCount}
                              </span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>

                    {/* Sub-menu */}
                    {hasChildren && isExpanded && !collapsed && (
                      <div className="ml-11 mt-1 space-y-0.5">
                        {'children' in item && item.children.map((child) => (
                          <div key={child.id}>
                            <NavLink
                              to={child.href}
                              className={cn(
                                "flex items-center px-3 py-2 text-sm rounded-md transition-all",
                                isActive(child.href)
                                  ? "bg-[#1E293B] text-white font-medium"
                                  : "text-[#94A3B8] hover:bg-[#1E293B]/50 hover:text-white"
                              )}
                            >
                              <span className="truncate">{child.label}</span>
                            </NavLink>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Info Footer */}
        <div className="mt-auto p-4 border-t border-slate-800">
          {(() => {
            const initials = user?.username ? user.username.substring(0, 2).toUpperCase() : "US";

            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 w-full hover:bg-[#1E293B]/50 p-2 rounded-lg transition-all text-left">
                    <div className="w-8 h-8 bg-[#2563EB] rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-white">{initials}</span>
                    </div>
                    {!collapsed && (
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate capitalize">
                          {user?.username || "User"}
                        </div>
                        <div className="text-xs text-[#94A3B8] truncate">
                          {user?.role || "Profile"}
                        </div>
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border-slate-200">
                  <DropdownMenuItem className="cursor-pointer hover:bg-slate-100" onClick={() => window.location.href = '/settings/profile'}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>View Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-200" />
                  <DropdownMenuItem className="cursor-pointer text-red-600 hover:bg-red-50" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}