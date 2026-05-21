import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/AuthContext";
import "@/App.css";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || "/disclaimer";

  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
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
      // signUp may require confirmation depending on Supabase settings
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
    <div className="auth-shell" data-testid="login-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-name">BRUNEL</div>
          <div className="auth-brand-rule" />
          <div className="auth-brand-sub">Powered by ARCHE</div>
        </div>

        <div className="auth-title">
          {mode === "signin" ? "Sign in to continue" : "Create your account"}
        </div>
        <div className="auth-subtitle">
          {mode === "signin"
            ? "Your conversation, your memory — wherever you sign in."
            : "BRUNEL remembers across devices. Start by claiming your space."}
        </div>

        <form onSubmit={submit} className="auth-form">
          <input
            type="email"
            className="auth-input"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            autoComplete="email"
            data-testid="auth-email"
          />
          <input
            type="password"
            className="auth-input"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            data-testid="auth-password"
          />

          {err && (
            <div className="auth-error" data-testid="auth-error">
              {err}
            </div>
          )}
          {info && (
            <div className="auth-info" data-testid="auth-info">
              {info}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={busy || !email.trim() || !password}
            data-testid="auth-submit"
          >
            {busy ? "..." : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button
                type="button"
                className="auth-link"
                onClick={() => { setMode("signup"); setErr(""); setInfo(""); }}
                data-testid="auth-switch-signup"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="auth-link"
                onClick={() => { setMode("signin"); setErr(""); setInfo(""); }}
                data-testid="auth-switch-signin"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
