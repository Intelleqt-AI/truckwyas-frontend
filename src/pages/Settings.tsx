import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { SettingsShell, SETTINGS_NAV } from "./settings/SettingsShell";

// Import individual setting pages
import { ProfileSettings } from "./settings/ProfileSettings";
import { NotificationSettings } from "./settings/NotificationSettings";
import { SecuritySettings } from "./settings/SecuritySettings";
import { CompanySettings } from "./settings/CompanySettings";
import { UsersPermissions } from "./settings/UsersPermissions";
import { BillingSettings } from "./settings/BillingSettings";
import { IntegrationsSettings } from "./settings/IntegrationsSettings";
import { CustomersDirectory } from "./settings/CustomersDirectory";
import { VehiclesDirectory } from "./settings/VehiclesDirectory";
import { VehicleTypesDirectory } from "./settings/VehicleTypesDirectory";
import { DeveloperApi } from "./settings/DeveloperApi";

// Section id -> component. Labels, grouping and the admin-only flag live in
// SETTINGS_NAV (SettingsShell.tsx) so the sub-page routes share the same nav.
const COMPONENTS: Record<string, () => JSX.Element> = {
  profile: ProfileSettings,
  notifications: NotificationSettings,
  security: SecuritySettings,
  company: CompanySettings,
  users: UsersPermissions,
  billing: BillingSettings,
  integrations: IntegrationsSettings,
  customers: CustomersDirectory,
  vehicles: VehiclesDirectory,
  'vehicle-types': VehicleTypesDirectory,
  'risk-api': DeveloperApi,
};

const ALL_ITEMS = SETTINGS_NAV.flatMap(s => s.items);

export default function Settings() {
  const { section } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  if (!section) return <Navigate to="/settings/profile" replace />;

  const current = ALL_ITEMS.find(i => i.id === section);

  // Redirect non-admins away from admin-only sections
  if (current?.adminOnly && !isAdmin) {
    return <Navigate to="/settings/profile" replace />;
  }

  const CurrentComponent = (current && COMPONENTS[current.id]) || ProfileSettings;

  return (
    <SettingsShell activeId={section}>
      <CurrentComponent />
    </SettingsShell>
  );
}
