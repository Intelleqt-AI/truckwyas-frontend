import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Download, 
  Calendar, 
  BarChart3, 
  Search,
  Filter,
  Clock,
  TrendingUp,
  Settings,
  Zap,
  Building2,
  DollarSign,
  Truck,
  Users,
  FileBarChart,
  PieChart,
  LineChart,
  Activity
} from "lucide-react";
import { MODULE_HEADINGS, PAGE_DESCRIPTIONS } from "@/lib/copy";
import { formatCurrency, formatDate } from "@/lib/formatters";

export default function Reports() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [dateRange, setDateRange] = useState("last-30-days");

  const reportCategories = [
    {
      id: "financial",
      title: "Financial Intelligence",
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success-light/20",
      description: "P&L, cash flow, and profitability analysis",
      reports: [
        { name: "Profit & Loss Statement", frequency: "Weekly", lastRun: "2024-01-15", size: "2.3 MB", status: "ready" },
        { name: "Cash Flow Analysis", frequency: "Daily", lastRun: "2024-01-15", size: "1.8 MB", status: "generating" },
        { name: "Lane Profitability Report", frequency: "Monthly", lastRun: "2024-01-14", size: "4.2 MB", status: "ready" },
        { name: "Invoice Aging Analysis", frequency: "Weekly", lastRun: "2024-01-13", size: "1.1 MB", status: "ready" }
      ]
    },
    {
      id: "operational",
      title: "Operations Performance",
      icon: Truck,
      color: "text-brand-500",
      bgColor: "bg-brand-100/50",
      description: "Fleet utilization, delivery metrics, and efficiency",
      reports: [
        { name: "Fleet Utilization Report", frequency: "Daily", lastRun: "2024-01-15", size: "3.1 MB", status: "ready" },
        { name: "On-Time Delivery Analysis", frequency: "Daily", lastRun: "2024-01-15", size: "2.7 MB", status: "ready" },
        { name: "Route Efficiency Report", frequency: "Weekly", lastRun: "2024-01-14", size: "1.9 MB", status: "ready" },
        { name: "Driver Performance Metrics", frequency: "Monthly", lastRun: "2024-01-13", size: "2.4 MB", status: "ready" }
      ]
    },
    {
      id: "ai-insights",
      title: "AI-Powered Insights",
      icon: Zap,
      color: "text-warning",
      bgColor: "bg-warning-light/20",
      description: "Predictive analytics and optimization recommendations",
      reports: [
        { name: "Revenue Optimization Insights", frequency: "Daily", lastRun: "2024-01-15", size: "1.5 MB", status: "ready" },
        { name: "Demand Forecasting Report", frequency: "Weekly", lastRun: "2024-01-14", size: "2.8 MB", status: "ready" },
        { name: "Cost Analysis & Predictions", frequency: "Monthly", lastRun: "2024-01-12", size: "3.4 MB", status: "ready" },
        { name: "Market Intelligence Brief", frequency: "Weekly", lastRun: "2024-01-13", size: "1.7 MB", status: "ready" }
      ]
    },
    {
      id: "compliance",
      title: "Compliance & Audit",
      icon: Building2,
      color: "text-neutral-600",
      bgColor: "bg-muted/20",
      description: "Regulatory compliance and audit trail reports",
      reports: [
        { name: "DOT Compliance Report", frequency: "Monthly", lastRun: "2024-01-10", size: "1.8 MB", status: "ready" },
        { name: "Safety Audit Trail", frequency: "Weekly", lastRun: "2024-01-14", size: "2.1 MB", status: "ready" },
        { name: "Environmental Impact Report", frequency: "Quarterly", lastRun: "2024-01-01", size: "4.7 MB", status: "ready" },
        { name: "Tax Reporting Summary", frequency: "Monthly", lastRun: "2024-01-12", size: "1.6 MB", status: "ready" }
      ]
    }
  ];

  const recentReports = [
    { 
      name: "Weekly P&L Summary", 
      category: "Financial", 
      date: "2024-01-15", 
      size: "2.3 MB", 
      status: "completed",
      downloads: 47
    },
    { 
      name: "Fleet Performance Dashboard", 
      category: "Operational", 
      date: "2024-01-15", 
      size: "3.1 MB", 
      status: "completed",
      downloads: 23
    },
    { 
      name: "AI Revenue Insights", 
      category: "AI Insights", 
      date: "2024-01-14", 
      size: "1.8 MB", 
      status: "completed",
      downloads: 31
    },
    { 
      name: "DOT Compliance Check", 
      category: "Compliance", 
      date: "2024-01-13", 
      size: "1.4 MB", 
      status: "completed",
      downloads: 12
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge className="bg-success-light text-success border-success/20">Ready</Badge>;
      case "generating":
        return <Badge className="bg-warning-light text-warning border-warning/20">Generating</Badge>;
      case "completed":
        return <Badge className="bg-success-light text-success border-success/20">Completed</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-body-medium font-body-medium text-foreground flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-muted-foreground" />
            Reports & Analytics
          </h1>
          <p className="text-caption text-muted-foreground">
            {PAGE_DESCRIPTIONS.reports}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-brand-100/50 text-brand-500 border-brand-500/20">
            124 Reports Generated
          </Badge>
          <Button 
            variant="outline"
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Schedule Reports
          </Button>
          <Button className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export All
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="ai-insights">AI Insights</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-48">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                <SelectItem value="last-90-days">Last 90 Days</SelectItem>
                <SelectItem value="last-year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Report Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {reportCategories.map((category) => {
          const IconComponent = category.icon;
          
          return (
            <Card key={category.id} className="bg-card border-border hover:shadow-glow transition-smooth">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-caption text-muted-foreground flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${category.bgColor}`}>
                      <IconComponent className={`h-4 w-4 ${category.color}`} />
                    </div>
                    {category.title}
                  </CardTitle>
                  <Badge className="bg-muted text-muted-foreground">
                    {category.reports.length} Reports
                  </Badge>
                </div>
                <p className="text-caption text-muted-foreground mt-1">
                  {category.description}
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {category.reports.map((report) => (
                    <div key={report.name} className="flex items-center justify-between p-3 hover:bg-muted/20 rounded-lg transition-smooth">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-body font-body-medium text-foreground">{report.name}</span>
                          {getStatusBadge(report.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-caption text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {report.frequency}
                          </span>
                          <span className="text-caption text-muted-foreground">
                            Last: {formatDate(report.lastRun)}
                          </span>
                          <span className="text-caption text-muted-foreground">
                            {report.size}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="hover:bg-muted/50">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Reports */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-caption text-muted-foreground">Recent Reports</CardTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentReports.map((report) => (
              <div key={report.name} className="flex items-center justify-between p-4 border border-border rounded-lg hover:shadow-glow transition-smooth">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-muted/20">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-body font-body-medium text-foreground">{report.name}</span>
                      {getStatusBadge(report.status)}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-caption text-muted-foreground">{report.category}</span>
                      <span className="text-caption text-muted-foreground">
                        {formatDate(report.date)}
                      </span>
                      <span className="text-caption text-muted-foreground">{report.size}</span>
                      <span className="text-caption text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {report.downloads} downloads
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    <Activity className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[
          { label: "Reports Generated", value: "124", subtitle: "This month", icon: FileBarChart },
          { label: "Data Processed", value: "2.4TB", subtitle: "Last 30 days", icon: PieChart },
          { label: "Avg Generation Time", value: "42s", subtitle: "↓12% vs last month", icon: Clock },
          { label: "Active Schedules", value: "18", subtitle: "Automated reports", icon: Calendar }
        ].map((stat, index) => (
          <Card key={index} className="bg-card border-border hover:shadow-glow transition-smooth">
            <CardHeader className="pb-3">
              <CardTitle className="text-caption text-muted-foreground flex items-center gap-2">
                <stat.icon className="h-4 w-4" />
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-body font-body-medium text-foreground text-tabular">
                {stat.value}
              </div>
              <p className="text-caption text-muted-foreground mt-1">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}