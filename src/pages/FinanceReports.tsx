import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ChevronDown, ChevronRight, Sparkles, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import financialReportsData from "@/mocks/financial-reports.json";

interface CollapsibleRowProps {
  name: string;
  actuals: number;
  budget: number;
  forecast: number;
  children?: any[];
  level?: number;
  aiCommentary?: string;
  isPercentage?: boolean;
}

function CollapsibleRow({ name, actuals, budget, forecast, children, level = 0, aiCommentary, isPercentage = false }: CollapsibleRowProps) {
  const [isOpen, setIsOpen] = useState(level === 0);
  const hasChildren = children && children.length > 0;
  
  const actualVsBudget = actuals - budget;
  const actualVsBudgetPct = budget !== 0 ? (actualVsBudget / budget) : 0;
  
  const formatValue = (val: number) => isPercentage ? formatPercentage(val / 100, 1) : formatCurrency(val);
  
  return (
    <>
      <TableRow className={`${level === 0 ? 'bg-accent/30 font-display-semibold' : level === 1 ? 'bg-accent/10' : ''}`}>
        <TableCell className={`${level > 0 ? `pl-${4 + level * 8}` : 'pl-4'}`}>
          <div className="flex items-center gap-2">
            {hasChildren && (
              <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            )}
            <span className={level === 0 ? 'text-foreground' : 'text-muted-foreground'}>{name}</span>
            {aiCommentary && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Sparkles className="h-4 w-4 text-brand-500" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-caption">{aiCommentary}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right font-mono">{formatValue(actuals)}</TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">{formatValue(budget)}</TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">{formatValue(forecast)}</TableCell>
        <TableCell className="text-right font-mono">
          {isPercentage ? formatPercentage(actualVsBudgetPct, 1) : formatCurrency(actualVsBudget)}
        </TableCell>
        <TableCell className="text-right">
          <span className={actualVsBudgetPct > 0 ? 'text-success-500' : actualVsBudgetPct < 0 ? 'text-danger-500' : 'text-muted-foreground'}>
            {formatPercentage(actualVsBudgetPct, 1)}
          </span>
        </TableCell>
      </TableRow>
      {hasChildren && isOpen && children.map((child, idx) => (
        <CollapsibleRow
          key={idx}
          name={child.name}
          actuals={child.actuals}
          budget={child.budget}
          forecast={child.forecast}
          children={child.children}
          level={level + 1}
          aiCommentary={child.aiCommentary}
        />
      ))}
    </>
  );
}

export default function FinanceReports() {
  const data = financialReportsData;
  
  const [periodType, setPeriodType] = useState("Monthly");
  const [selectedMonth, setSelectedMonth] = useState("Oct");
  const [selectedYear, setSelectedYear] = useState("2025");

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const quarters = ["Q1", "Q2", "Q3", "Q4"];
  const years = ["2023", "2024", "2025"];
  
  const getPeriodOptions = () => {
    if (periodType === "Quarterly") return quarters;
    if (periodType === "Yearly") return years;
    return months;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-body-medium font-body-medium text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Financial Reports
          </h1>
          <p className="text-caption text-muted-foreground">
            Industry audit-quality reporting
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pnl" className="w-full">
        <TabsList>
          <TabsTrigger value="pnl">P&L Statement</TabsTrigger>
          <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
        </TabsList>

        {/* Time Period Filter */}
        <div className="flex items-center gap-0 w-fit mt-6">
          <Select value={periodType} onValueChange={setPeriodType}>
            <SelectTrigger className="w-[140px] rounded-r-none border-r-0 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Monthly">Monthly</SelectItem>
              <SelectItem value="Quarterly">Quarterly</SelectItem>
              <SelectItem value="Yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[100px] rounded-none border-r-0 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getPeriodOptions().map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px] rounded-l-none font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* P&L Statement */}
        <TabsContent value="pnl" className="mt-6 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-muted-foreground">Profit & Loss Statement</CardTitle>
              <p className="text-caption text-muted-foreground mt-1">Detailed hierarchical breakdown with variance analysis</p>
            </CardHeader>
            <CardContent>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Line Item</TableHead>
                    <TableHead className="text-right">Actuals</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Forecast</TableHead>
                    <TableHead className="text-right">Actuals vs Budget</TableHead>
                    <TableHead className="text-right">Variance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <CollapsibleRow
                    name="Revenue"
                    actuals={data.pnl.revenue.actuals}
                    budget={data.pnl.revenue.budget}
                    forecast={data.pnl.revenue.forecast}
                    children={data.pnl.revenue.children}
                    aiCommentary={data.pnl.revenue.aiCommentary}
                  />
                  <CollapsibleRow
                    name="Cost of Goods Sold"
                    actuals={data.pnl.cogs.actuals}
                    budget={data.pnl.cogs.budget}
                    forecast={data.pnl.cogs.forecast}
                    children={data.pnl.cogs.children}
                    aiCommentary={data.pnl.cogs.aiCommentary}
                  />
                  <TableRow className="bg-brand-500/10 font-display-semibold">
                    <TableCell className="pl-4">Gross Profit</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(data.pnl.grossProfit.actuals)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(data.pnl.grossProfit.budget)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(data.pnl.grossProfit.forecast)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(data.pnl.grossProfit.actuals - data.pnl.grossProfit.budget)}</TableCell>
                    <TableCell className="text-right text-success-500">{formatPercentage((data.pnl.grossProfit.actuals - data.pnl.grossProfit.budget) / data.pnl.grossProfit.budget, 1)}</TableCell>
                  </TableRow>
                  <CollapsibleRow
                    name="Gross Profit %"
                    actuals={data.pnl.grossProfit.margin * 100}
                    budget={65.9}
                    forecast={69.4}
                    isPercentage={true}
                  />
                  <CollapsibleRow
                    name="Operating Expenses"
                    actuals={data.pnl.opex.actuals}
                    budget={data.pnl.opex.budget}
                    forecast={data.pnl.opex.forecast}
                    children={data.pnl.opex.children}
                    aiCommentary={data.pnl.opex.aiCommentary}
                  />
                  <TableRow className="bg-brand-900/20 font-display-bold border-t-2 border-brand-500">
                    <TableCell className="pl-4">Net Profit</TableCell>
                    <TableCell className="text-right font-mono text-lg">{formatCurrency(data.pnl.netProfit.actuals)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(data.pnl.netProfit.budget)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(data.pnl.netProfit.forecast)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(data.pnl.netProfit.actuals - data.pnl.netProfit.budget)}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-success-500">{formatPercentage((data.pnl.netProfit.actuals - data.pnl.netProfit.budget) / data.pnl.netProfit.budget, 1)}</span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance" className="mt-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assets */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-muted-foreground">Assets</CardTitle>
              </CardHeader>
              <CardContent>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-body font-body-medium text-foreground">Current Assets</h4>
                    <div className="text-right">
                      <div className="text-display-sm font-display-bold tabular-nums">{formatCurrency(data.balanceSheet.assets.current.total)}</div>
                      <div className={`text-caption ${data.balanceSheet.assets.current.delta > 0 ? 'text-success-500' : 'text-danger-500'}`}>
                        {data.balanceSheet.assets.current.delta > 0 ? '+' : ''}{formatCurrency(data.balanceSheet.assets.current.delta)} vs last month
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {data.balanceSheet.assets.current.items.map((item) => (
                      <div key={item.name} className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-body text-muted-foreground">{item.name}</span>
                        <div className="text-right">
                          <div className="text-body font-mono">{formatCurrency(item.value)}</div>
                          <div className={`text-caption ${item.delta > 0 ? 'text-success-500' : 'text-danger-500'}`}>
                            {item.delta > 0 ? '+' : ''}{formatCurrency(item.delta)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-body font-body-medium text-foreground">Fixed Assets</h4>
                    <div className="text-right">
                      <div className="text-display-sm font-display-bold tabular-nums">{formatCurrency(data.balanceSheet.assets.fixed.total)}</div>
                      <div className={`text-caption ${data.balanceSheet.assets.fixed.delta > 0 ? 'text-success-500' : 'text-danger-500'}`}>
                        {data.balanceSheet.assets.fixed.delta > 0 ? '+' : ''}{formatCurrency(data.balanceSheet.assets.fixed.delta)} vs last month
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {data.balanceSheet.assets.fixed.items.map((item) => (
                      <div key={item.name} className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-body text-muted-foreground">{item.name}</span>
                        <div className="text-right">
                          <div className="text-body font-mono">{formatCurrency(item.value)}</div>
                          <div className={`text-caption ${item.delta > 0 ? 'text-success-500' : 'text-danger-500'}`}>
                            {item.delta > 0 ? '+' : ''}{formatCurrency(item.delta)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-brand-500">
                  <div className="flex items-center justify-between">
                    <h4 className="text-display-sm font-display-semibold text-foreground">Total Assets</h4>
                    <div className="text-display-md font-display-bold tabular-nums text-brand-500">
                      {formatCurrency(data.balanceSheet.assets.current.total + data.balanceSheet.assets.fixed.total)}
                    </div>
                  </div>
                </div>
              </div>
              </CardContent>
            </Card>

            {/* Liabilities & Equity */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-muted-foreground">Liabilities & Equity</CardTitle>
              </CardHeader>
              <CardContent>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-body font-body-medium text-foreground">Current Liabilities</h4>
                    <div className="text-right">
                      <div className="text-display-sm font-display-bold tabular-nums">{formatCurrency(data.balanceSheet.liabilities.current.total)}</div>
                      <div className={`text-caption ${data.balanceSheet.liabilities.current.delta > 0 ? 'text-danger-500' : 'text-success-500'}`}>
                        {data.balanceSheet.liabilities.current.delta > 0 ? '+' : ''}{formatCurrency(data.balanceSheet.liabilities.current.delta)} vs last month
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {data.balanceSheet.liabilities.current.items.map((item) => (
                      <div key={item.name} className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-body text-muted-foreground">{item.name}</span>
                        <div className="text-right">
                          <div className="text-body font-mono">{formatCurrency(item.value)}</div>
                          <div className={`text-caption ${item.delta > 0 ? 'text-danger-500' : 'text-success-500'}`}>
                            {item.delta > 0 ? '+' : ''}{formatCurrency(item.delta)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-body font-body-medium text-foreground">Long-term Liabilities</h4>
                    <div className="text-right">
                      <div className="text-display-sm font-display-bold tabular-nums">{formatCurrency(data.balanceSheet.liabilities.longTerm.total)}</div>
                      <div className={`text-caption ${data.balanceSheet.liabilities.longTerm.delta > 0 ? 'text-danger-500' : 'text-success-500'}`}>
                        {data.balanceSheet.liabilities.longTerm.delta > 0 ? '+' : ''}{formatCurrency(data.balanceSheet.liabilities.longTerm.delta)} vs last month
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {data.balanceSheet.liabilities.longTerm.items.map((item) => (
                      <div key={item.name} className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-body text-muted-foreground">{item.name}</span>
                        <div className="text-right">
                          <div className="text-body font-mono">{formatCurrency(item.value)}</div>
                          <div className={`text-caption ${item.delta > 0 ? 'text-danger-500' : 'text-success-500'}`}>
                            {item.delta > 0 ? '+' : ''}{formatCurrency(item.delta)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-body font-body-medium text-foreground">Equity</h4>
                    <div className="text-right">
                      <div className="text-display-sm font-display-bold tabular-nums">{formatCurrency(data.balanceSheet.equity.total)}</div>
                      <div className={`text-caption ${data.balanceSheet.equity.delta > 0 ? 'text-success-500' : 'text-danger-500'}`}>
                        {data.balanceSheet.equity.delta > 0 ? '+' : ''}{formatCurrency(data.balanceSheet.equity.delta)} vs last month
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-brand-500">
                  <div className="flex items-center justify-between">
                    <h4 className="text-display-sm font-display-semibold text-foreground">Total Liabilities & Equity</h4>
                    <div className="text-display-md font-display-bold tabular-nums text-brand-500">
                      {formatCurrency(data.balanceSheet.liabilities.current.total + data.balanceSheet.liabilities.longTerm.total + data.balanceSheet.equity.total)}
                    </div>
                  </div>
                </div>
              </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cash Flow Statement */}
        <TabsContent value="cashflow" className="mt-6 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-muted-foreground">Cash Flow Statement</CardTitle>
                  <p className="text-caption text-muted-foreground mt-1">Real-time sync with bookings and capital activities</p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-500/10">
                        <Sparkles className="h-4 w-4 text-brand-500" />
                        <span className="text-caption font-body-medium text-brand-500">AI Insight</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md">
                      <p className="text-caption">{data.cashFlow.aiCommentary}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
              {/* Operating Activities */}
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-brand-500/30">
                  <h4 className="text-body font-display-semibold text-foreground">Operating Activities</h4>
                  <div className="text-display-sm font-display-bold tabular-nums text-success-500">
                    {formatCurrency(data.cashFlow.operating.total)}
                  </div>
                </div>
                <div className="space-y-3 ml-4">
                  {data.cashFlow.operating.items.map((item) => (
                    <div key={item.name} className="flex items-center justify-between py-2">
                      <span className="text-body text-muted-foreground">{item.name}</span>
                      <span className="text-body font-mono">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Investing Activities */}
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-brand-500/30">
                  <h4 className="text-body font-display-semibold text-foreground">Investing Activities</h4>
                  <div className="text-display-sm font-display-bold tabular-nums text-danger-500">
                    {formatCurrency(data.cashFlow.investing.total)}
                  </div>
                </div>
                <div className="space-y-3 ml-4">
                  {data.cashFlow.investing.items.map((item) => (
                    <div key={item.name} className="flex items-center justify-between py-2">
                      <span className="text-body text-muted-foreground">{item.name}</span>
                      <span className="text-body font-mono">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financing Activities */}
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-brand-500/30">
                  <h4 className="text-body font-display-semibold text-foreground">Financing Activities</h4>
                  <div className="text-display-sm font-display-bold tabular-nums text-danger-500">
                    {formatCurrency(data.cashFlow.financing.total)}
                  </div>
                </div>
                <div className="space-y-3 ml-4">
                  {data.cashFlow.financing.items.map((item) => (
                    <div key={item.name} className="flex items-center justify-between py-2">
                      <span className="text-body text-muted-foreground">{item.name}</span>
                      <span className="text-body font-mono">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Net Change */}
              <div className="pt-6 border-t-2 border-brand-500">
                <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-brand-500/10 to-brand-300/10">
                  <h4 className="text-display-sm font-display-bold text-foreground">Net Change in Cash</h4>
                  <div className={`text-display-lg font-display-bold tabular-nums ${data.cashFlow.netChange > 0 ? 'text-success-500' : 'text-danger-500'}`}>
                    {data.cashFlow.netChange > 0 ? '+' : ''}{formatCurrency(data.cashFlow.netChange)}
                  </div>
                </div>
              </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}