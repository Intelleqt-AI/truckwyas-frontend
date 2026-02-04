import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KPIItem {
  label: string;
  value: string;
}

export function ExecutiveSnapshot() {
  const kpis: KPIItem[] = [
    {
      label: "Revenue (MTD)",
      value: "R 2.4M"
    },
    {
      label: "Net Margin % (MTD)",
      value: "18.7%"
    },
    {
      label: "Cash on Hand",
      value: "R 847K"
    },
    {
      label: "Predicted Balance (30 Days)",
      value: "R 1.2M"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => (
        <Card key={index} className="bg-card border-border hover:shadow-glow transition-smooth">
          <CardHeader className="pb-3">
            <CardTitle className="text-caption text-muted-foreground">
              {kpi.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-body font-body-medium text-foreground text-tabular">
              {kpi.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}