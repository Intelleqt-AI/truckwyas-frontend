import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  MapPin, 
  Cloud, 
  Shield, 
  AlertTriangle,
  Eye,
  EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MapUnavailableEmpty } from "./empty-states";

interface MapOverlay {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  enabled: boolean;
}

interface MapOverlaysProps {
  overlays: MapOverlay[];
  onToggleOverlay: (overlayId: string) => void;
  mapboxKey?: string;
  className?: string;
}

export function MapOverlays({ 
  overlays, 
  onToggleOverlay, 
  mapboxKey,
  className 
}: MapOverlaysProps) {
  if (!mapboxKey) {
    return <MapUnavailableEmpty />;
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-body-medium font-body-medium text-foreground">
              Map Overlays
            </h4>
            <Badge variant="outline" className="text-xs">
              {overlays.filter(o => o.enabled).length} active
            </Badge>
          </div>
          
          <div className="grid gap-2">
            {overlays.map((overlay) => {
              const Icon = overlay.icon;
              return (
                <Button
                  key={overlay.id}
                  variant={overlay.enabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => onToggleOverlay(overlay.id)}
                  className={cn(
                    "justify-start h-auto p-3 transition-all duration-200",
                    overlay.enabled && `bg-${overlay.color} hover:bg-${overlay.color}/80`
                  )}
                >
                  <div className="flex items-center gap-3 w-full">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <div className="text-xs font-body-medium">
                        {overlay.name}
                      </div>
                      <div className="text-xs opacity-80">
                        {overlay.description}
                      </div>
                    </div>
                    {overlay.enabled ? (
                      <Eye className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <EyeOff className="w-3 h-3 flex-shrink-0 opacity-50" />
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Default overlay configurations
export const DEFAULT_MAP_OVERLAYS: MapOverlay[] = [
  {
    id: 'border-delays',
    name: 'Border Delays',
    description: 'Show current border crossing delays',
    icon: MapPin,
    color: 'warning',
    enabled: true
  },
  {
    id: 'weather',
    name: 'Weather',
    description: 'Weather conditions and alerts',
    icon: Cloud,
    color: 'brand-500',
    enabled: false
  },
  {
    id: 'crime-heat',
    name: 'Crime Heat',
    description: 'Security risk areas and incidents',
    icon: Shield,
    color: 'danger',
    enabled: false
  }
];

// Map wrapper component with overlays
export function TruckwysMap({ 
  plans = [], 
  overlays = DEFAULT_MAP_OVERLAYS,
  mapboxKey,
  className 
}: {
  plans?: any[];
  overlays?: MapOverlay[];
  mapboxKey?: string;
  className?: string;
}) {
  const [activeOverlays, setActiveOverlays] = useState(overlays);

  const handleToggleOverlay = (overlayId: string) => {
    setActiveOverlays(prev => 
      prev.map(overlay => 
        overlay.id === overlayId 
          ? { ...overlay, enabled: !overlay.enabled }
          : overlay
      )
    );
  };

  if (!mapboxKey) {
    return (
      <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6", className)}>
        <div className="lg:col-span-2">
          <MapUnavailableEmpty />
        </div>
        <MapOverlays 
          overlays={activeOverlays}
          onToggleOverlay={handleToggleOverlay}
          mapboxKey={mapboxKey}
        />
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6", className)}>
      <div className="lg:col-span-2">
        <Card className="h-96">
          <CardContent className="p-0 h-full">
            {/* This would be the actual Mapbox map component */}
            <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center space-y-2">
                <MapPin className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-body text-muted-foreground">
                  Interactive map would load here
                </p>
                <p className="text-caption text-muted-foreground">
                  Mapbox integration ready
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <MapOverlays 
        overlays={activeOverlays}
        onToggleOverlay={handleToggleOverlay}
        mapboxKey={mapboxKey}
      />
    </div>
  );
}