import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Key, Smartphone, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export function SecuritySettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(true);

  const handleChangePassword = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success("Password changed successfully");
    setIsLoading(false);
  };

  const sessions = [
    {
      id: 1,
      device: "Chrome on Windows",
      location: "Johannesburg, South Africa",
      lastActive: "Current session",
      current: true
    },
    {
      id: 2,
      device: "Safari on iPhone",
      location: "Cape Town, South Africa", 
      lastActive: "2 hours ago",
      current: false
    },
    {
      id: 3,
      device: "Chrome on MacBook",
      location: "Durban, South Africa",
      lastActive: "1 day ago",
      current: false
    }
  ];

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-heading text-foreground">Security Settings</h1>
        <p className="text-caption text-muted-foreground">
          Manage your account security and authentication preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Password */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-body-medium">
              <Key className="w-4 h-4" />
              Password
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="currentPassword" className="text-caption">Current Password</Label>
              <Input id="currentPassword" type="password" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newPassword" className="text-caption">New Password</Label>
              <Input id="newPassword" type="password" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="text-caption">Confirm New Password</Label>
              <Input id="confirmPassword" type="password" />
            </div>
            <Button onClick={handleChangePassword} disabled={isLoading} size="sm" className="w-full">
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-body-medium">
              <Smartphone className="w-4 h-4" />
              Two-Factor Authentication
              {twoFactorEnabled && (
                <Badge variant="outline" className="bg-success/10 text-success border-success/20 ml-auto">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Enabled
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between py-1">
              <div>
                <Label className="text-body">Enable 2FA</Label>
                <p className="text-caption text-muted-foreground">
                  Extra security using authenticator app
                </p>
              </div>
              <Switch
                checked={twoFactorEnabled}
                onCheckedChange={setTwoFactorEnabled}
              />
            </div>
            
            {twoFactorEnabled && (
              <div className="bg-muted/20 p-3 rounded-lg space-y-2">
                <p className="text-caption text-foreground">Authenticator App Connected</p>
                <p className="text-caption text-muted-foreground">
                  Protected with Google Authenticator
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Recovery Codes
                  </Button>
                  <Button variant="outline" size="sm">
                    Reconfigure
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Security Preferences & Active Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Security Preferences */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-body-medium">
              <Shield className="w-4 h-4" />
              Security Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between py-1">
              <div>
                <Label className="text-body">Auto Session Timeout</Label>
                <p className="text-caption text-muted-foreground">
                  Log out after 30 minutes of inactivity
                </p>
              </div>
              <Switch
                checked={sessionTimeout}
                onCheckedChange={setSessionTimeout}
              />
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-body-medium">Active Sessions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {sessions.slice(0, 2).map((session, index) => (
                <div key={session.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-body">{session.device}</p>
                        {session.current && (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-caption text-muted-foreground">
                        {session.location} • {session.lastActive}
                      </p>
                    </div>
                    {!session.current && (
                      <Button variant="outline" size="sm">
                        Revoke
                      </Button>
                    )}
                  </div>
                  {index === 0 && <div className="border-t border-border mt-2 pt-2" />}
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-2 text-caption text-muted-foreground mt-3 pt-2 border-t border-border">
              <AlertTriangle className="w-3 h-3" />
              <span>Report suspicious activity immediately</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}