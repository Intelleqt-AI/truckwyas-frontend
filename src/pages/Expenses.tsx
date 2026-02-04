import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LayoutGrid, 
  List, 
  Receipt, 
  Fuel, 
  Wrench, 
  TrendingDown,
  Plus 
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

export default function Expenses() {
  const [view, setView] = useState<"board" | "list">("list");

  // Mock KPI data
  const kpiData = [
    {
      title: "Total Expenses (MTD)",
      value: formatCurrency(1247890),
      subtitle: "-3.2% vs last month",
      icon: Receipt,
      color: "text-brand-500"
    },
    {
      title: "Fuel Costs",
      value: formatCurrency(687420),
      subtitle: "55% of total",
      icon: Fuel,
      color: "text-warning"
    },
    {
      title: "Maintenance",
      value: formatCurrency(234560),
      subtitle: "19% of total",
      icon: Wrench,
      color: "text-primary"
    },
    {
      title: "Pending Approval",
      value: "12",
      subtitle: formatCurrency(45890),
      icon: TrendingDown,
      color: "text-destructive"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-body-medium font-body-medium text-foreground flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Expenses
          </h1>
          <p className="text-caption text-muted-foreground">
            Track and manage fleet operating costs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as "board" | "list")}>
            <TabsList>
              <TabsTrigger value="board" className="gap-2">
                <LayoutGrid className="w-4 h-4" />
                Board
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="w-4 h-4" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, index) => (
          <Card 
            key={index} 
            className="bg-card border-border hover:shadow-glow transition-smooth"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-caption text-muted-foreground">
                {kpi.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-body font-body-medium text-foreground text-tabular">
                {kpi.value}
              </div>
              <p className="text-caption text-muted-foreground mt-1">{kpi.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content - Coming Soon State */}
      <Card className="bg-card border-border">
        <CardContent className="p-12 text-center">
          <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-body font-body-medium text-foreground mb-2">
            Expense Management Coming Soon
          </h3>
          <p className="text-caption text-muted-foreground mb-6 max-w-md mx-auto">
            Track fuel, maintenance, tolls, and all operating costs. Approve expenses and analyze spending patterns.
          </p>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Record First Expense
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}