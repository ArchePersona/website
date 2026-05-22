import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="auth-card">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/brunel/login" state={{ from: location }} replace />;
  }

  return children;
}
