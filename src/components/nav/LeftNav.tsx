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
import { tokenStorage } from "@/lib/tokenStorage";

const iconMap = {
  LayoutDashboard,
  Shield,
  Tower: Radio,
  Building2,
  Banknote,
  Truck,
  FileText,
  Settings,
};

export function LeftNav() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const loadUser = () => {
      const userData = tokenStorage.getUser();
      if (userData) {
        setUser(userData);
      }
    };

    loadUser();
    window.addEventListener('storage', loadUser);
    return () => window.removeEventListener('storage', loadUser);
  }, []);

  const { mutate: logout } = usePost({
    onSuccess: () => {
      tokenStorage.clearAll();
      window.location.href = '/login';
    },
    onError: () => {
      tokenStorage.clearAll();
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
    <Sidebar className="border-r-0 bg-sidebar-background mt-16" style={{ "--sidebar-width": "14rem" } as React.CSSProperties}>
      <SidebarContent>
        {/* Navigation Menu */}
        <SidebarGroup className="py-4 px-6">
          <SidebarGroupContent>
            <SidebarMenu>
              {NAVIGATION_ITEMS.map((item) => {
                const IconComponent = iconMap[item.icon as keyof typeof iconMap];
                const hasChildren = 'children' in item;
                const isExpanded = expandedMenu === item.id;

                return (
                  <div key={item.id}>
                    <SidebarMenuItem>
                      {hasChildren ? (
                        <div
                          onClick={() => handleMenuClick(item.id)}
                          className={cn(
                            getParentClassName(item),
                            "flex items-center justify-between cursor-pointer rounded-md px-2 py-2"
                          )}
                        >
                          <div className="flex items-center">
                            <IconComponent className="w-5 h-5 mr-3 flex-shrink-0" />
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
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={'href' in item ? item.href : '#'}
                            className={getNavClassName('href' in item ? item.href : '#')}
                          >
                            <IconComponent className="w-5 h-5 mr-3 flex-shrink-0" />
                            {!collapsed && (
                              <span className="truncate">{item.label}</span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>

                    {/* Sub-menu */}
                    {hasChildren && isExpanded && !collapsed && (
                      <div className="ml-8 mt-2 space-y-1">
                        {'children' in item && item.children.map((child) => (
                          <div key={child.id} className="py-1">
                            <NavLink
                              to={child.href}
                              className={cn(
                                "flex items-center px-2 py-2 text-sm rounded-md transition-smooth",
                                isActive(child.href)
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
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
        <div className="mt-auto p-4 border-t border-sidebar-border">
          {(() => {
            const initials = user?.username ? user.username.substring(0, 2).toUpperCase() : "US";

            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 w-full hover:bg-sidebar-accent/50 p-2 rounded-lg transition-smooth text-left">
                    <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-white">{initials}</span>
                    </div>
                    {!collapsed && (
                      <div className="min-w-0 flex-1">
                        <div className="text-caption font-body-medium text-sidebar-foreground truncate capitalize">
                          {user?.username || "User"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {user?.role || "Profile"}
                        </div>
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-full bg-sidebar-background border-sidebar-border">
                  <DropdownMenuItem className="cursor-pointer hover:bg-sidebar-accent" onClick={() => window.location.href = '/settings/profile'}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>View Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-sidebar-border" />
                  <DropdownMenuItem className="cursor-pointer text-destructive hover:bg-destructive/10" onClick={handleLogout}>
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