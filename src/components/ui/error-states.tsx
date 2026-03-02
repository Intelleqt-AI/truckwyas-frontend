import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  AlertTriangle, 
  RefreshCw, 
  Wifi,
  Server,
  Database,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title: string;
  description: string;
  error?: string;
  onRetry?: () => void;
  variant?: "destructive" | "default";
  className?: string;
}

export function ErrorState({ 
  title, 
  description, 
  error,
  onRetry,
  variant = "destructive",
  className 
}: ErrorStateProps) {
  return (
    <Alert variant={variant} className={cn("border-2", className)}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="font-body-medium">{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-body">{description}</p>
        {error && (
          <details className="text-caption text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Technical details</summary>
            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">{error}</pre>
          </details>
        )}
        {onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="mt-3"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Specific error states for common scenarios
export function ConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorState
      title="Connection Error"
      description="Unable to connect to the server. Please check your internet connection and try again."
      onRetry={onRetry}
      variant="destructive"
    />
  );
}

export function DataLoadError({ onRetry, error }: { onRetry: () => void; error?: string }) {
  return (
    <ErrorState
      title="Failed to Load Data"
      description="There was a problem loading the requested data. This might be a temporary issue."
      error={error}
      onRetry={onRetry}
    />
  );
}

export function ApiError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <ErrorState
      title="API Error"
      description={message}
      onRetry={onRetry}
    />
  );
}

export function PermissionError() {
  return (
    <Card className="border-2 border-destructive/20 bg-destructive/5">
      <CardContent className="p-6 text-center">
        <div className="space-y-4">
          <div className="w-12 h-12 bg-destructive/20 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6 text-destructive" />
          </div>
          <div className="space-y-2">
            <h3 className="text-heading font-body-medium text-foreground">
              Access Denied
            </h3>
            <p className="text-body text-muted-foreground">
              You don't have permission to access this resource. Contact your administrator if you believe this is an error.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function NotFoundError({ onGoBack }: { onGoBack?: () => void }) {
  return (
    <Card className="border-2 border-warning/20 bg-warning/5">
      <CardContent className="p-6 text-center">
        <div className="space-y-4">
          <div className="w-12 h-12 bg-warning/20 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-warning" />
          </div>
          <div className="space-y-2">
            <h3 className="text-heading font-body-medium text-foreground">
              Resource Not Found
            </h3>
            <p className="text-body text-muted-foreground">
              The requested resource could not be found. It may have been moved or deleted.
            </p>
          </div>
          {onGoBack && (
            <Button variant="outline" onClick={onGoBack}>
              Go Back
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Inline error banner for forms and specific sections
export function InlineError({
  message,
  onRetry,
  onDismiss,
  className
}: {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-destructive/20 bg-destructive/5 p-3", className)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-body text-foreground">{message}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-auto p-1 text-xs hover:bg-destructive/10"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-auto p-1 text-xs hover:bg-destructive/10"
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Empty state for when there's no data
export function EmptyState({
  icon: Icon = Database,
  title,
  description,
  action,
  onAction,
  className
}: {
  icon?: any;
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn("border-2", className)}>
      <CardContent className="p-6 text-center">
        <div className="space-y-4">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
            <Icon className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-heading font-body-medium text-foreground">
              {title}
            </h3>
            {description && (
              <p className="text-body text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action && onAction && (
            <Button onClick={onAction}>
              {action}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}