import { Navigate, Outlet } from "react-router-dom";
import { tokenStorage } from "@/lib/tokenStorage";
import { isTokenValid } from "@/lib/jwtValidation";

const ProtectedRoute = () => {
  const token = tokenStorage.getToken();

  if (!token || !isTokenValid(token)) {
    // Clear stale/invalid tokens so the user gets a clean login
    if (token) {
      tokenStorage.clearAll();
    }
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
