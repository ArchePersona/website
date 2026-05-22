import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Send, LogOut, Shield, Copy, ClipboardCopy } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import "./App.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error("VITE_BACKEND_URL is not configured.");
}

const API = `${BACKEND_URL}/api`;

function Chat() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  const sessionId = user?.id || "";
  const isAdmin = (user?.email || "").toLowerCase() === "archepersona@gmail.com";

  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);
  const scrollRef = useRef(null);

  const authHeader = useMemo(
    () => (session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    [session?.access_token]
  );

  useEffect(() => {
    if (!sessionId || !session?.access_token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/session/${sessionId}`, { headers: authHeader });
        if (cancelled) return;
        const d = r.data;
        setMessages(
          (d.rk_history || []).flatMap((t) => [
            { role: "user", content: t.user, ts: t.ts || null },
            { role: "assistant", content: t.assistant, ts: t.ts || null },
          ])
        );
      } catch (e) {
        console.warn("session hydrate failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, session?.access_token, authHeader]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setText("");
    setMessages((m) => [...m, { role: "user", content: msg, ts: new Date().toISOString() }]);
    try {
      const r = await axios.post(`${API}/chat`, { message: msg, target: "rk_only" }, { headers: authHeader });
      const d = r.data;
      const content = d.rk_response || d.plain_response || "";
      if (content) {
        setMessages((m) => [...m, { role: "assistant", content, ts: new Date().toISOString() }]);
      }
    } catch (e) {
      console.error(e);
      const errMsg = `[ link to engine failed — ${e?.response?.data?.detail || e.message} ]`;
      setMessages((m) => [...m, { role: "assistant", content: errMsg, ts: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const pairs = useMemo(() => {
    const out = [];
    let pending = null;
    for (const m of messages) {
      if (m.role === "user") {
        if (pending) out.push(pending);
        pending = { user: m.content, userTs: m.ts, assistant: null, assistantTs: null };
      } else if (pending) {
        pending.assistant = m.content;
        pending.assistantTs = m.ts;
        out.push(pending);
        pending = null;
      } else {
        out.push({ user: null, userTs: null, assistant: m.content, assistantTs: m.ts });
      }
    }
    if (pending) out.push(pending);
    return out;
  }, [messages]);

  const fmtTs = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}/${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
  };

  const formatThread = () => pairs.map((p) => [p.user && `You: ${p.user}`, p.assistant && `BRUNEL: ${p.assistant}`].filter(Boolean).join("\n\n")).filter(Boolean).join("\n\n---\n\n");
  const copyThread = async () => {
    await navigator.clipboard.writeText(formatThread());
    setCopiedKey("thread");
    setTimeout(() => setCopiedKey(null), 1200);
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-name">BRUNEL</div>
          <div className="brand-rule" />
          <div className="brand-sub">Powered by ARCHE</div>
        </div>
        <div className="topbar-right">
          <span className="session-id">{user?.email || "—"}</span>
          <button className="reset-btn" onClick={copyThread} disabled={pairs.length === 0}><ClipboardCopy size={11} /> {copiedKey === "thread" ? "Copied" : "Copy"}</button>
          {isAdmin && <button className="reset-btn" onClick={() => navigate("/brunel/admin")}><Shield size={11} /> Admin</button>}
          <button className="reset-btn" onClick={() => signOut()}><LogOut size={11} /> Sign out</button>
        </div>
      </div>

      <div className="panel panel-rk solo">
        <div className="chat-body" ref={scrollRef}>
          {pairs.length === 0 ? <div className="empty-state">say something — i'll remember it</div> : pairs.map((p, i) => (
            <div key={i} className="pair">
              {p.user && <div className="bubble bubble-user">{p.user}</div>}
              {p.assistant && <div className="bubble bubble-assistant">{p.assistant}</div>}
              {(p.assistantTs || p.userTs) && <div className="pair-timestamp">{fmtTs(p.assistantTs || p.userTs)}</div>}
            </div>
          ))}
          {sending && <div className="thinking">considering</div>}
        </div>
        <div className="panel-input">
          <div className="input-row">
            <textarea className="input" placeholder="Say something real..." value={text} disabled={sending} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
            <button className="send" onClick={send} disabled={sending || !text.trim()} aria-label="send"><Send size={14} /></button>
          </div>
        </div>
      </div>

      <div className="footnote"><span>BRUNEL · An ArchePersona product</span><span className="footnote-tag">Powered by ARCHE</span></div>
    </div>
  );
}

export default Chat;
