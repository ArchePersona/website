import { useNavigate } from "react-router-dom";
import "./App.css";

export default function Admin() {
  const navigate = useNavigate();

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-name">BRUNEL</div>
          <div className="auth-brand-rule" />
          <div className="auth-brand-sub">admin</div>
        </div>
        <div className="auth-title">Admin panel</div>
        <div className="auth-subtitle">
          Admin controls are wired through the backend. This route is present so the shell does not 404.
        </div>
        <button className="auth-submit" onClick={() => navigate("/brunel")}>Back to BRUNEL</button>
      </div>
    </div>
  );
}
