import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface SignalCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  subtitle: string;
  buttonText: string;
  onClick: () => void;
  variant?: 'default' | 'warning' | 'danger';
}

export function SignalCard({
  icon: Icon,
  title,
  value,
  subtitle,
  buttonText,
  onClick,
  variant = 'default'
}: SignalCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          iconColor: 'text-warning',
          iconBg: 'bg-warning-light'
        };
      case 'danger':
        return {
          iconColor: 'text-danger',
          iconBg: 'bg-danger-500/10'
        };
      default:
        return {
          iconColor: 'text-brand-500',
          iconBg: 'bg-brand-100'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Card className="bg-card border border-border hover-lift transition-smooth shadow-card p-6">
      <div className="space-y-4">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg ${styles.iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${styles.iconColor}`} />
        </div>
        
        {/* Content */}
        <div className="space-y-1">
          <h3 className="text-caption text-muted-foreground">
            {title}
          </h3>
          <div className="text-body-medium font-body-medium text-foreground text-tabular">
            {value}
          </div>
          <p className="text-caption text-muted-foreground">
            {subtitle}
          </p>
        </div>
        
        {/* Action */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onClick}
          className="w-full"
        >
          {buttonText}
        </Button>
      </div>
    </Card>
  );
}