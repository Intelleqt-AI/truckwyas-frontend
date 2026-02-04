import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Users, Database, Shield, AlertTriangle } from "lucide-react";

export default function Admin() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            System Administration
          </h1>
          <p className="text-muted-foreground">
            Platform configuration and system management
          </p>
        </div>
        <Badge className="bg-success-light text-success border-success/20">
          All Systems Healthy
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-2xl font-bold text-foreground">24</div>
              <p className="text-sm text-muted-foreground">Active users</p>
              <Button variant="outline" className="w-full" size="sm">
                Manage Users
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-success" />
              Data Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-2xl font-bold text-foreground">98.7%</div>
              <p className="text-sm text-muted-foreground">System uptime</p>
              <Button variant="outline" className="w-full" size="sm">
                View Logs
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-warning" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-2xl font-bold text-foreground">High</div>
              <p className="text-sm text-muted-foreground">Security level</p>
              <Button variant="outline" className="w-full" size="sm">
                Security Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-2xl font-bold text-destructive">2</div>
              <p className="text-sm text-muted-foreground">System alerts</p>
              <Button variant="outline" className="w-full" size="sm">
                View Alerts
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>System Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border border-border rounded">
                <div>
                  <div className="font-medium">AI Agent Settings</div>
                  <div className="text-sm text-muted-foreground">Configure AI behaviour and thresholds</div>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              <div className="flex items-center justify-between p-3 border border-border rounded">
                <div>
                  <div className="font-medium">Pricing Rules</div>
                  <div className="text-sm text-muted-foreground">Set pricing algorithms and boundaries</div>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              <div className="flex items-center justify-between p-3 border border-border rounded">
                <div>
                  <div className="font-medium">Integration Settings</div>
                  <div className="text-sm text-muted-foreground">Manage external API connections</div>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Recent System Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 bg-success rounded-full mt-2" />
                <div>
                  <div className="font-medium">System backup completed</div>
                  <div className="text-muted-foreground">2 hours ago</div>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 bg-warning rounded-full mt-2" />
                <div>
                  <div className="font-medium">High API usage detected</div>
                  <div className="text-muted-foreground">4 hours ago</div>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                <div>
                  <div className="font-medium">New user registered</div>
                  <div className="text-muted-foreground">6 hours ago</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}