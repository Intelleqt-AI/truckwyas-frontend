import { useState } from "react";
import { Bell, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
import truckwysLogo from "@/assets/truckwys-logo.png";

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

export function TopBar() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: notificationsData } = useFetch<PaginatedResponse<AppNotification>>("api/notifications/");
  const notificationList = notificationsData?.results || [];

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

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-[40] transition-all duration-300" />
      )}
      <header className="h-16 bg-nav-bg border-b border-nav-border shadow-nav flex items-center justify-between px-6 fixed top-0 left-0 right-0 z-50">
        {/* Left Section - Logo & Menu */}
        <div className="flex items-center gap-4">
          <img
            src={truckwysLogo}
            alt="Truckwys"
            className="h-20"
          />
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        </div>

        {/* Center Section - AI Search */}
        <div className="flex-1 max-w-lg mx-8">
          <div className="relative">
            <Sparkles className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary w-4 h-4" />
            <Input
              placeholder="Ask AI about loads, quotes, invoices..."
              className="pl-10 bg-background border-border"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <DropdownMenu onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {notificationList.filter(n => n.unread).length > 0 && (
                  <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs border-2 border-nav-bg">
                    {notificationList.filter(n => n.unread).length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-background border-border p-0 shadow-xl">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <DropdownMenuLabel className="p-0 font-heading text-body-medium">Notifications</DropdownMenuLabel>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-primary hover:bg-transparent"
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
                        className="flex flex-col items-start gap-1 p-4 cursor-pointer border-b border-border/50 last:border-0 focus:bg-accent/50"
                        onClick={() => notification.unread && handleMarkAsRead(notification.id)}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="flex items-center gap-2">
                            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-success" />}
                            {notification.type === 'warning' && <AlertCircle className="w-4 h-4 text-warning" />}
                            {notification.type === 'info' && <Info className="w-4 h-4 text-primary" />}
                            <span className={cn("text-body-medium", notification.unread ? "font-semibold" : "font-normal")}>
                              {notification.title}
                            </span>
                          </div>
                          {notification.unread && (
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          )}
                        </div>
                        <p className="text-caption text-muted-foreground line-clamp-2">
                          {notification.description}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">{notification.time}</span>
                        </div>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      <p className="text-sm">No notifications</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="p-2 border-t border-border bg-muted/30">
                <Button variant="ghost" className="w-full text-xs h-8 hover:bg-accent">
                  View all notifications
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  );
}