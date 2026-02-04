import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Zap, CheckCircle, AlertCircle, Settings, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'connected' | 'disconnected' | 'error';
  logo: string;
  lastSync?: string;
  enabled: boolean;
}

const integrations: Integration[] = [
  {
    id: 'xero',
    name: 'Xero',
    description: 'Sync invoices and financial data with your accounting system',
    category: 'Accounting',
    status: 'connected',
    logo: '💼',
    lastSync: '2 hours ago',
    enabled: true
  },
  {
    id: 'sap',
    name: 'SAP',
    description: 'Enterprise resource planning integration',
    category: 'ERP',
    status: 'connected',
    logo: '🏢',
    lastSync: '1 day ago',
    enabled: true
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Alternative accounting software integration',
    category: 'Accounting',
    status: 'disconnected',
    logo: '📊',
    enabled: false
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Business management software integration',
    category: 'ERP',
    status: 'error',
    logo: '🌿',
    lastSync: 'Failed',
    enabled: false
  },
  {
    id: 'fleet-complete',
    name: 'Fleet Complete',
    description: 'Fleet tracking and telematics data',
    category: 'Telematics',
    status: 'connected',
    logo: '📍',
    lastSync: '15 minutes ago',
    enabled: true
  },
  {
    id: 'mixtelematics',
    name: 'MiX Telematics',
    description: 'Advanced fleet management and driver behavior',
    category: 'Telematics',
    status: 'disconnected',
    logo: '🚛',
    enabled: false
  }
];

export function IntegrationsSettings() {
  const [integrationsList, setIntegrationsList] = useState(integrations);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(integrations.map(i => i.category)))];

  const filteredIntegrations = selectedCategory === 'all' 
    ? integrationsList 
    : integrationsList.filter(i => i.category === selectedCategory);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-success/10 text-success border-success/20';
      case 'error':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const handleConnect = (integrationId: string) => {
    setIntegrationsList(prev => 
      prev.map(integration => 
        integration.id === integrationId 
          ? { ...integration, status: 'connected' as const, enabled: true, lastSync: 'Just now' }
          : integration
      )
    );
    toast.success("Integration connected successfully");
  };

  const handleDisconnect = (integrationId: string) => {
    setIntegrationsList(prev => 
      prev.map(integration => 
        integration.id === integrationId 
          ? { ...integration, status: 'disconnected' as const, enabled: false, lastSync: undefined }
          : integration
      )
    );
    toast.success("Integration disconnected");
  };

  const handleToggle = (integrationId: string) => {
    const integration = integrationsList.find(i => i.id === integrationId);
    if (integration?.status === 'connected') {
      setIntegrationsList(prev => 
        prev.map(i => 
          i.id === integrationId 
            ? { ...i, enabled: !i.enabled }
            : i
        )
      );
      toast.success(integration.enabled ? "Integration paused" : "Integration resumed");
    }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-foreground">Integrations</h1>
          <p className="text-caption text-muted-foreground">
            Connect Truckwys with your existing tools and systems
          </p>
        </div>
        
        {/* Category Filter */}
        <div className="flex gap-2">
          {categories.slice(0, 4).map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category === 'all' ? 'All' : category}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">
                  {integrationsList.filter(i => i.status === 'connected').length}
                </p>
                <p className="text-caption text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">
                  {integrationsList.filter(i => i.enabled).length}
                </p>
                <p className="text-caption text-muted-foreground">Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-body-medium text-foreground text-tabular">
                  {integrationsList.filter(i => i.status === 'error').length}
                </p>
                <p className="text-caption text-muted-foreground">Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Keys Card */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
                <Settings className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-body-medium text-foreground">API Keys</p>
                <p className="text-caption text-muted-foreground">Manage</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIntegrations.slice(0, 6).map((integration) => (
          <Card key={integration.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-lg">{integration.logo}</div>
                  <div>
                    <CardTitle className="text-body-medium">{integration.name}</CardTitle>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {integration.category}
                    </Badge>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={getStatusColor(integration.status)}
                >
                  {getStatusIcon(integration.status)}
                  {integration.status.charAt(0).toUpperCase() + integration.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0 space-y-3">
              <p className="text-caption text-muted-foreground">
                {integration.description}
              </p>

              {integration.status === 'connected' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-caption">Enable Integration</span>
                    <Switch
                      checked={integration.enabled}
                      onCheckedChange={() => handleToggle(integration.id)}
                    />
                  </div>
                  
                  {integration.lastSync && (
                    <div className="text-caption text-muted-foreground">
                      Last sync: {integration.lastSync}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-border">
                <div className="flex gap-1">
                  {integration.status === 'connected' ? (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="gap-1 h-7 px-2"
                      >
                        <Settings className="w-3 h-3" />
                        Config
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDisconnect(integration.id)}
                        className="h-7 px-2"
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button 
                      size="sm"
                      onClick={() => handleConnect(integration.id)}
                      className="h-7 px-3"
                    >
                      Connect
                    </Button>
                  )}
                </div>
                
                <Button variant="ghost" size="sm" className="gap-1 h-7 px-2">
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* API Keys Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body-medium">API Keys</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="apiKey" className="text-caption">Production API Key</Label>
            <div className="flex gap-2">
              <Input 
                id="apiKey"
                value="tw_live_********************************"
                readOnly
                className="font-mono text-caption"
              />
              <Button variant="outline" size="sm">Copy</Button>
              <Button variant="outline" size="sm">Regenerate</Button>
            </div>
          </div>
          
          <div className="bg-muted/20 p-3 rounded-lg">
            <p className="text-caption text-foreground mb-1">⚠️ Security Notice</p>
            <p className="text-caption text-muted-foreground">
              Keep your API keys secure and never share them publicly. 
              Regenerate keys if you suspect they have been compromised.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}