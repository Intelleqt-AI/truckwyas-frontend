import { Banknote, Receipt, Clock, Truck, Users, UserRound, ShieldAlert, MapPin, Percent, Wallet, Route, Weight, Wrench, Fuel, Gauge, BriefcaseBusiness, Building2, Package, CheckCircle2, XCircle, CalendarDays } from 'lucide-react';
import './dashboard-metric-icon.css';

const icons = {
  money: Banknote, invoice: Receipt, overdue: Clock, truck: Truck,
  customers: Users, driver: UserRound, risk: ShieldAlert, location: MapPin,
  percent: Percent, wallet: Wallet, route: Route, weight: Weight,
  maintenance: Wrench, fuel: Fuel, health: Gauge, experience: BriefcaseBusiness,
  company: Building2, order: Package, complete: CheckCircle2, cancelled: XCircle,
  date: CalendarDays, expense: Receipt,
};
export type DashboardMetricIconKind = keyof typeof icons;

export function DashboardMetricIcon({ kind }: { kind: DashboardMetricIconKind }) {
  const Icon = icons[kind];
  return <Icon className="dashboard-metric-icon" size={16} strokeWidth={1.5} aria-hidden="true" focusable="false" />;
}
