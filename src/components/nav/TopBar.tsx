import { useState, useEffect } from "react";
import { Bell, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import useFetch from "@/hooks/useFetch";
import { usePost } from "@/hooks/usePost";
import { useQueryClient } from "@tanstack/react-query";

// Notification interface
interface AppNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  unread: boolean;
  created_at: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Page title mapping
const PAGE_TITLES: Record<string, string> = {
  '/': 'Home',
  '/bookings': 'Orders',
  '/bookings/pipeline': 'Pipeline',
  '/finance-hq': 'Finance Overview',
  '/finance/invoices': 'Invoices',
  '/finance/expenses': 'Expenses',
  '/finance/reports': 'Reports',
  '/capital': 'Capital',
  '/fleet': 'Fleet Dashboard',
  '/fleet/vehicles': 'Vehicles',
  '/fleet/drivers': 'Drivers',
  '/settings': 'Settings',
};

export function TopBar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const queryClient = useQueryClient();
  const { data: notificationsData } = useFetch<PaginatedResponse<AppNotification>>("api/notifications/");
  const notificationList = notificationsData?.results || [];

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, []);

  const { mutate: markRead } = usePost({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api/notifications/"] });
    }
  });

  const handleMarkAllAsRead = () => {
    markRead({ url: "api/notifications/mark-read/", data: { all: true } });
  };

  const handleMarkAsRead = (id: string) => {
    markRead({ url: "api/notifications/mark-read/", data: { ids: [id] } });
  };

  const pageTitle = PAGE_TITLES[location.pathname] || 'TruckWys';

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-[40] transition-all duration-300" />
      )}
      <header className="h-16 bg-white border-b border-[#F1F5F9] flex items-center justify-between px-8 sticky top-0 z-40">
        {/* Left Section - Page Title/Breadcrumb */}
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-[#0F172A]">{pageTitle}</h1>
        </div>

        {/* Right Section - Notifications & User */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <DropdownMenu onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative hover:bg-slate-100">
                <Bell className="w-5 h-5 text-slate-600" />
                {notificationList.filter(n => n.unread).length > 0 && (
                  <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-[#2563EB] text-white text-xs border-2 border-white">
                    {notificationList.filter(n => n.unread).length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-white border-slate-200 p-0 shadow-xl">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <DropdownMenuLabel className="p-0 font-semibold text-sm">Notifications</DropdownMenuLabel>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-[#2563EB] hover:bg-transparent hover:text-[#1D4ED8]"
                  onClick={handleMarkAllAsRead}
                >
                  Mark all as read
                </Button>
              </div>
              <ScrollArea className="h-[350px]">
                <div className="flex flex-col">
                  {notificationList.length > 0 ? (
                    notificationList.map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className="flex flex-col items-start gap-1 p-4 cursor-pointer border-b border-slate-100 last:border-0 focus:bg-slate-50"
                        onClick={() => notification.unread && handleMarkAsRead(notification.id)}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="flex items-center gap-2">
                            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
                            {notification.type === 'warning' && <AlertCircle className="w-4 h-4 text-[#F59E0B]" />}
                            {notification.type === 'info' && <Info className="w-4 h-4 text-[#2563EB]" />}
                            <span className={cn("text-sm", notification.unread ? "font-semibold text-[#0F172A]" : "font-normal text-[#64748B]")}>
                              {notification.title}
                            </span>
                          </div>
                          {notification.unread && (
                            <div className="w-2 h-2 bg-[#2563EB] rounded-full" />
                          )}
                        </div>
                        <p className="text-xs text-[#64748B] line-clamp-2">
                          {notification.description}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-[#94A3B8]" />
                          <span className="text-[10px] text-[#94A3B8]">{notification.time}</span>
                        </div>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="p-8 text-center text-[#64748B]">
                      <p className="text-sm">No notifications</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User avatar removed — user actions are in sidebar footer */}
        </div>
      </header>
    </>
  );
}