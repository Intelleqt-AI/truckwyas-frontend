import { SidebarProvider } from "@/components/ui/sidebar";
import { LeftNav } from "@/components/nav/LeftNav";
import { TopBar } from "@/components/nav/TopBar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-dashboard">
        <TopBar />
        <LeftNav />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto mt-16">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}