import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SelectionCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  isSelected: boolean;
  isRecommended?: boolean;
  onClick: () => void;
}

export function SelectionCard({ 
  icon: Icon, 
  title, 
  description, 
  isSelected, 
  isRecommended,
  onClick 
}: SelectionCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        className={cn(
          "relative cursor-pointer transition-all duration-200 hover:shadow-md",
          isSelected 
            ? "border-brand-500 bg-brand-500/5 shadow-sm" 
            : "border-border hover:border-brand-300"
        )}
        onClick={onClick}
      >
        {isRecommended && isSelected && (
          <Badge 
            className="absolute -top-2 -right-2 bg-brand-500 text-white text-xs px-2 py-1"
          >
            Recommended
          </Badge>
        )}
        
        <CardContent className="p-6 space-y-4">
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center transition-colors",
            isSelected 
              ? "bg-brand-500 text-white" 
              : "bg-muted text-muted-foreground"
          )}>
            <Icon className="w-6 h-6" />
          </div>
          
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}