import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Mail, Smartphone, Save } from "lucide-react";
import { toast } from "sonner";
import useFetch from "@/hooks/useFetch";
import { usePatch } from "@/hooks/usePatch";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function NotificationSettings() {
  const queryClient = useQueryClient();
  const { data: fetchedSettings, isLoading: isFetching } = useFetch("api/notifications/settings/");

  const [settings, setSettings] = useState({
    email: {
      quotes: true,
      bookings: true,
      invoices: false,
      alerts: true,
      marketing: false
    },
    push: {
      quotes: true,
      bookings: true,
      alerts: true,
      messages: false
    },
    sms: {
      alerts: true,
      confirmations: false
    }
  });

  useEffect(() => {
    if (fetchedSettings) {
      setSettings(fetchedSettings);
    }
  }, [fetchedSettings]);

  const { mutate: updateSettings, isPending: isUpdating } = usePatch({
    onSuccess: () => {
      toast.success("Notification preferences updated");
      queryClient.invalidateQueries({ queryKey: ["api/notifications/settings/"] });
    },
    onError: () => {
      toast.error("Failed to update preferences");
    }
  });

  const handleSave = () => {
    updateSettings({ url: "api/notifications/settings/", data: settings });
  };

  const updateSetting = (category: keyof typeof settings, key: string, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-heading text-foreground">Notification Settings</h1>
        <p className="text-caption text-muted-foreground">
          Configure how you want to receive notifications across different channels
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Email Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-body-medium">
              <Mail className="w-4 h-4" />
              Email Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between py-1">
              <div>
                <Label htmlFor="email-quotes" className="text-body">Quote Updates</Label>
                <p className="text-caption text-muted-foreground">Sent, accepted, or expired notifications</p>
              </div>
              <Switch
                id="email-quotes"
                checked={settings.email.quotes}
                onCheckedChange={(checked) => updateSetting('email', 'quotes', checked)}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <Label htmlFor="email-bookings" className="text-body">Booking Updates</Label>
                <p className="text-caption text-muted-foreground">Status changes and delivery confirmations</p>
              </div>
              <Switch
                id="email-bookings"
                checked={settings.email.bookings}
                onCheckedChange={(checked) => updateSetting('email', 'bookings', checked)}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <Label htmlFor="email-invoices" className="text-body">Invoice Notifications</Label>
                <p className="text-caption text-muted-foreground">Generated invoices and payment reminders</p>
              </div>
              <Switch
                id="email-invoices"
                checked={settings.email.invoices}
                onCheckedChange={(checked) => updateSetting('email', 'invoices', checked)}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <Label htmlFor="email-alerts" className="text-body">System Alerts</Label>
                <p className="text-caption text-muted-foreground">Important system notifications</p>
              </div>
              <Switch
                id="email-alerts"
                checked={settings.email.alerts}
                onCheckedChange={(checked) => updateSetting('email', 'alerts', checked)}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <Label htmlFor="email-marketing" className="text-body">Marketing Updates</Label>
                <p className="text-caption text-muted-foreground">Feature announcements and tips</p>
              </div>
              <Switch
                id="email-marketing"
                checked={settings.email.marketing}
                onCheckedChange={(checked) => updateSetting('email', 'marketing', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Push & SMS Notifications */}
        <div className="space-y-4">
          {/* Push Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-body-medium">
                <Smartphone className="w-4 h-4" />
                Push Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center justify-between py-1">
                <div>
                  <Label htmlFor="push-quotes" className="text-body">Quote Activities</Label>
                  <p className="text-caption text-muted-foreground">Instant quote notifications</p>
                </div>
                <Switch
                  id="push-quotes"
                  checked={settings.push.quotes}
                  onCheckedChange={(checked) => updateSetting('push', 'quotes', checked)}
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <Label htmlFor="push-bookings" className="text-body">Booking Updates</Label>
                  <p className="text-caption text-muted-foreground">Real-time booking changes</p>
                </div>
                <Switch
                  id="push-bookings"
                  checked={settings.push.bookings}
                  onCheckedChange={(checked) => updateSetting('push', 'bookings', checked)}
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <Label htmlFor="push-alerts" className="text-body">Critical Alerts</Label>
                  <p className="text-caption text-muted-foreground">Urgent system alerts</p>
                </div>
                <Switch
                  id="push-alerts"
                  checked={settings.push.alerts}
                  onCheckedChange={(checked) => updateSetting('push', 'alerts', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* SMS Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-body-medium">
                <Bell className="w-4 h-4" />
                SMS Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center justify-between py-1">
                <div>
                  <Label htmlFor="sms-alerts" className="text-body">Critical Alerts</Label>
                  <p className="text-caption text-muted-foreground">Emergency alerts only</p>
                </div>
                <Switch
                  id="sms-alerts"
                  checked={settings.sms.alerts}
                  onCheckedChange={(checked) => updateSetting('sms', 'alerts', checked)}
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <Label htmlFor="sms-confirmations" className="text-body">Delivery Confirmations</Label>
                  <p className="text-caption text-muted-foreground">SMS for completed deliveries</p>
                </div>
                <Switch
                  id="sms-confirmations"
                  checked={settings.sms.confirmations}
                  onCheckedChange={(checked) => updateSetting('sms', 'confirmations', checked)}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={isUpdating} size="sm" className="gap-2">
                  <Save className="w-4 h-4" />
                  {isUpdating ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}