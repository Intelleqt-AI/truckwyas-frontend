import { SidebarProvider } from "@/components/ui/sidebar";
import { LeftNav } from "@/components/nav/LeftNav";
import { TopBar } from "@/components/nav/TopBar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-muted/30">
        {/* Dark Sidebar - Fixed Left */}
        <LeftNav />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Clean Top Bar */}
          <TopBar />

          {/* Main Content - #FAFAFA background */}
          <main className="flex-1 p-8 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}