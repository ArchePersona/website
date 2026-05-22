import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Send, LogOut, Shield, ClipboardCopy, Mic, MicOff, Paperclip } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import "./App.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://brunel-5lxo.onrender.com";
const API = `${BACKEND_URL}/api`;
const MAX_FILE_CHARS = 18000;

function Chat() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  const sessionId = user?.id || "";
  const isAdmin = (user?.email || "").toLowerCase() === "archepersona@gmail.com";

  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [fileStatus, setFileStatus] = useState("");
  const recognitionRef = useRef(null);
  const speechBaseRef = useRef("");
  const fileInputRef = useRef(null);
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

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => {
      setListening(false);
      const reason = event?.error || "speech recognition error";
      setMessages((m) => [...m, { role: "assistant", content: `[ free speech input failed — ${reason} ]`, ts: new Date().toISOString() }]);
    };
    recognition.onresult = (event) => {
      let transcriptText = "";

      for (let i = 0; i < event.results.length; i += 1) {
        transcriptText += event.results[i][0]?.transcript || "";
      }

      const spoken = transcriptText.trim();
      const base = speechBaseRef.current.trim();

      if (spoken) setText(base ? `${base} ${spoken}` : spoken);
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try { recognition.stop(); } catch (_) { /* noop */ }
      recognitionRef.current = null;
    };
  }, []);

  const toggleSpeech = () => {
    if (!speechSupported || !recognitionRef.current) {
      setMessages((m) => [...m, { role: "assistant", content: "[ free speech input is not supported in this browser — try mobile Chrome or type it in ]", ts: new Date().toISOString() }]);
      return;
    }

    try {
      if (listening) {
        recognitionRef.current.stop();
      } else {
        speechBaseRef.current = text;
        recognitionRef.current.start();
      }
    } catch (e) {
      setListening(false);
      setMessages((m) => [...m, { role: "assistant", content: `[ free speech input failed — ${e.message} ]`, ts: new Date().toISOString() }]);
    }
  };

  const openFilePicker = () => {
    if (sending) return;
    fileInputRef.current?.click();
  };

  const attachFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const raw = await file.text();
      const truncated = raw.length > MAX_FILE_CHARS;
      const body = truncated ? raw.slice(0, MAX_FILE_CHARS) : raw;
      const fileBlock = `\n\n[Attached file: ${file.name}${file.type ? ` · ${file.type}` : ""}${truncated ? " · truncated" : ""}]\n\`\`\`\n${body}\n\`\`\``;
      setText((current) => `${current}${current.trim() ? "\n" : ""}${fileBlock}`.trimStart());
      setFileStatus(`${file.name}${truncated ? " attached, truncated" : " attached"}`);
      window.setTimeout(() => setFileStatus(""), 2400);
    } catch (e) {
      setFileStatus(`could not read ${file.name}`);
      setMessages((m) => [...m, { role: "assistant", content: `[ file attach failed — ${e.message} ]`, ts: new Date().toISOString() }]);
    }
  };

  const send = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setText("");
    setFileStatus("");
    speechBaseRef.current = "";
    if (listening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) { /* noop */ }
    }
    setMessages((m) => [...m, { role: "user", content: msg, ts: new Date().toISOString() }]);
    try {
      const r = await axios.post(`${API}/chat`, { message: msg, target: "rk_only" }, { headers: authHeader, timeout: 45000 });
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
          <div className="speech-status">{fileStatus || (listening ? "listening… tap mic again to stop" : speechSupported ? "free speech input available" : "speech input unsupported here")}</div>
          <input ref={fileInputRef} className="hidden-file-input" type="file" accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.py,.css,.html,.log,.csv,.yml,.yaml,.xml,.sql,text/*,application/json" onChange={attachFile} />
          <div className="input-row">
            <textarea className="input" placeholder="Say something real..." value={text} disabled={sending} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
            <button className="file-btn" onClick={openFilePicker} disabled={sending} aria-label="attach file"><Paperclip size={14} /></button>
            <button className={`mic-btn ${listening ? "listening" : ""}`} onClick={toggleSpeech} disabled={sending} aria-label={listening ? "stop voice input" : "start voice input"}>{listening ? <MicOff size={14} /> : <Mic size={14} />}</button>
            <button className="send" onClick={send} disabled={sending || !text.trim()} aria-label="send"><Send size={14} /></button>
          </div>
        </div>
      </div>

      <div className="footnote"><span>BRUNEL · An ArchePersona product</span><span className="footnote-tag">Powered by ARCHE</span></div>
    </div>
  );
}

export default Chat;
