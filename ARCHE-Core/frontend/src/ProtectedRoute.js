import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/AuthContext";

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-shell" data-testid="auth-loading">
        <div className="auth-loading-text">…</div>
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
