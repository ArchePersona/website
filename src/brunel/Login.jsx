import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import "./App.css";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || "/brunel";

  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setInfo("");
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      const fn = mode === "signin" ? signIn : signUp;
      const { data, error } = await fn(email.trim(), password);
      if (error) {
        setErr(error.message || "Something went wrong.");
        return;
      }
      if (mode === "signup" && !data?.session) {
        setInfo("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch (e2) {
      setErr(e2?.message || "Network error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-name">BRUNEL</div>
          <div className="auth-brand-rule" />
          <div className="auth-brand-sub">Powered by ARCHE</div>
        </div>
        <div className="auth-title">{mode === "signin" ? "Sign in to continue" : "Create your account"}</div>
        <div className="auth-subtitle">
          {mode === "signin" ? "Your conversation, your memory — wherever you sign in." : "BRUNEL remembers across devices. Start by claiming your space."}
        </div>
        <form onSubmit={submit} className="auth-form">
          <input className="auth-input" type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
          <input className="auth-input" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          {err && <div className="auth-error">{err}</div>}
          {info && <div className="auth-info">{info}</div>}
          <button className="auth-submit" disabled={busy || !email.trim() || !password}>{busy ? "..." : mode === "signin" ? "Sign in" : "Sign up"}</button>
        </form>
        <div className="auth-toggle">
          {mode === "signin" ? (
            <>No account? <button className="auth-link" onClick={() => { setMode("signup"); setErr(""); setInfo(""); }}>Sign up</button></>
          ) : (
            <>Already have an account? <button className="auth-link" onClick={() => { setMode("signin"); setErr(""); setInfo(""); }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
