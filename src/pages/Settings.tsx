import { useState } from "react";
import { motion } from "framer-motion";
import { NavLink, useParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Bell,
  Shield,
  Building2,
  Users,
  CreditCard,
  Zap,
  UsersIcon,
  Truck,
  Settings as SettingsIcon,
  Contact
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const SETTINGS_SECTIONS = [
  {
    title: "My Account",
    items: [
      {
        id: "profile",
        label: "Profile",
        icon: User,
        component: ProfileSettings,
        description: "Manage your personal information and preferences"
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        component: NotificationSettings,
        description: "Configure email and push notifications"
      },
      {
        id: "security",
        label: "Security",
        icon: Shield,
        component: SecuritySettings,
        description: "Password, 2FA, and security settings"
      }
    ]
  },
  {
    title: "Workspace",
    items: [
      {
        id: "company",
        label: "Company Details",
        icon: Building2,
        component: CompanySettings,
        description: "Company information and branding"
      },
      {
        id: "users",
        label: "Users & Permissions",
        icon: UsersIcon,
        component: UsersPermissions,
        description: "Manage team members and their access"
      },
      {
        id: "billing",
        label: "Billing",
        icon: CreditCard,
        component: BillingSettings,
        description: "Subscription and payment information"
      },
      {
        id: "integrations",
        label: "Integrations",
        icon: Zap,
        component: IntegrationsSettings,
        description: "Connect TMS, accounting, and other systems"
      }
    ]
  },
  {
    title: "Directory",
    items: [
      {
        id: "customers",
        label: "Customers",
        icon: Contact,
        component: CustomersDirectory,
        description: "Manage customer database and credit terms"
      },
      {
        id: "vehicles",
        label: "Vehicles",
        icon: Truck,
        component: VehiclesDirectory,
        description: "Fleet vehicle details and maintenance"
      },
      {
        id: "vehicle-types",
        label: "Vehicle Types",
        icon: SettingsIcon,
        component: VehicleTypesDirectory,
        description: "Configure vehicle type classifications"
      }
    ]
  }
];

export default function Settings() {
  const { section } = useParams();

  // If no section specified, redirect to profile
  if (!section) {
    return <Navigate to="/settings/profile" replace />;
  }

  // Find the current section and component
  const currentItem = SETTINGS_SECTIONS
    .flatMap(section => section.items)
    .find(item => item.id === section);

  const CurrentComponent = currentItem?.component || ProfileSettings;

  return (
    <div className="flex min-h-full">
      {/* Sidebar Navigation */}
      <div className="w-64 border-r border-border bg-card/30 flex-shrink-0">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-display-1 text-foreground">Settings</h1>
              <p className="text-caption text-muted-foreground">Manage your workspace</p>
            </div>
          </div>
        </div>

        <div className="p-3 space-y-4 overflow-y-auto">
          {SETTINGS_SECTIONS.map((sectionGroup, index) => (
            <motion.div
              key={sectionGroup.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <h3 className="text-caption text-muted-foreground uppercase tracking-wide px-3 mb-3">
                {sectionGroup.title}
              </h3>
              <div className="space-y-1">
                {sectionGroup.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = section === item.id;

                  return (
                    <NavLink
                      key={item.id}
                      to={`/settings/${item.id}`}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "hover:bg-accent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className={cn(
                        "w-4 h-4 shrink-0",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      <div className="min-w-0 flex-1">
                        <div className={cn(
                          "text-body-medium",
                          isActive ? "text-primary" : "text-foreground"
                        )}>
                          {item.label}
                        </div>
                      </div>
                    </NavLink>
                  );
                })}
              </div>
              {index < SETTINGS_SECTIONS.length - 1 && (
                <Separator className="mt-4" />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-background">
        <motion.div
          key={section}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="p-6 min-h-full max-w-full"
        >
          <CurrentComponent />
        </motion.div>
      </div>
    </div>
  );
}