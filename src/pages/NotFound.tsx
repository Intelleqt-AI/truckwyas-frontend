import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-dashboard">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-foreground mb-2">Page Not Found</h2>
          <p className="text-muted-foreground">
            Sorry, the page you're looking for doesn't exist in the Truckwys platform.
          </p>
        </div>
        
        <div className="space-y-4">
          <Button 
            onClick={() => window.history.back()}
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          
          <Button 
            onClick={() => window.location.href = '/'}
            className="w-full flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
