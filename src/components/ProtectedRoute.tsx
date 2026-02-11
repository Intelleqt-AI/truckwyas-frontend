import { Navigate, Outlet } from "react-router-dom";
import { tokenStorage } from "@/lib/tokenStorage";

const ProtectedRoute = () => {
  const token = tokenStorage.getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
