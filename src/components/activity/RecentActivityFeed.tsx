import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, Send, AlertTriangle, Plus, Calendar, Edit3 } from "lucide-react";
import { formatRelativeTime } from "@/lib/formatters";

interface ActivityItem {
  id: string;
  icon: string;
  color: string;
  text: string;
  timestamp: string;
  user: {
    initials: string;
  };
}

interface RecentActivityFeedProps {
  activities: ActivityItem[];
  title?: string;
}

const iconMap = {
  CheckCircle2,
  Send,
  AlertTriangle,
  Plus,
  Calendar,
  Edit3,
};

const colorMap = {
  success: "text-success-500",
  brand: "text-brand-500",
  warn: "text-warn-500",
  info: "text-brand-300",
};

export function RecentActivityFeed({ activities, title = "Recent Activity" }: RecentActivityFeedProps) {
  return (
    <Card className="bg-card border-border h-[500px] flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-body-large font-body-medium">{title}</CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0 flex-1 overflow-y-auto">
        <div className="space-y-4 pr-2">{activities.map((activity) => {
            const IconComponent = iconMap[activity.icon as keyof typeof iconMap];
            const iconColor = colorMap[activity.color as keyof typeof colorMap];
            
            return (
              <div key={activity.id} className="flex items-start gap-3 group">
                {/* Icon */}
                <div className={`mt-1 ${iconColor}`}>
                  {IconComponent && <IconComponent className="w-4 h-4" />}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div 
                    className="text-caption text-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: activity.text }}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                    <Avatar className="w-5 h-5">
                      <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                        {activity.user.initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}