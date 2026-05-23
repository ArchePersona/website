import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Send, LogOut, Shield, ClipboardCopy, Mic, MicOff, Paperclip, Trash2 } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import "./App.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://brunel-5lxo.onrender.com";
const API = `${BACKEND_URL}/api`;
const MAX_FILE_CHARS = 18000;

const STATE_VISUALS = {
  baseline: { color: "#7CFF8A", className: "state-baseline" },
  tender: { color: "#B8FFD0", className: "state-tender" },
  eager: { color: "#8DFF74", className: "state-eager" },
  focused: { color: "#9CFFB0", className: "state-focused" },
  reflective: { color: "#A9FFD8", className: "state-reflective" },
  steady: { color: "#78E88D", className: "state-steady" },
  guarded: { color: "#D6FF7A", className: "state-guarded" },
  concerned: { color: "#CFFF6B", className: "state-concerned" },
  restless: { color: "#66FF66", className: "state-restless" },
  sharp: { color: "#39FF6A", className: "state-sharp" },
};

const MODE_VISUALS = {
  "000": { label: "Conversation", className: "mode-conversation" },
  "111": { label: "Companion", className: "mode-companion" },
  "222": { label: "Assistant", className: "mode-assistant" },
  "333": { label: "Tutor", className: "mode-tutor" },
  "444": { label: "Creative", className: "mode-creative" },
  "555": { label: "Hearth", className: "mode-hearth" },
  "666": { label: "Technical", className: "mode-technical" },
  "777": { label: "Research", className: "mode-research" },
  "888": { label: "Sentinel", className: "mode-sentinel" },
  "911": { label: "Emergency", className: "mode-emergency" },
};

const TEST_VISUAL_STATE = "focused";
const TEST_VISUAL_MODE = "666";

function Chat() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  const sessionId = user?.id || "";
  const isAdmin = (user?.email || "").toLowerCase() === "archepersona@gmail.com";
  const assistantVisualClass = [
    STATE_VISUALS[TEST_VISUAL_STATE]?.className || STATE_VISUALS.baseline.className,
    MODE_VISUALS[TEST_VISUAL_MODE]?.className || MODE_VISUALS["000"].className,
  ].join(" ");

  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [fileStatus, setFileStatus] = useState("");
  const [viewMode, setViewMode] = useState("single");
  const recognitionRef = useRef(null);
  const speechBaseRef = useRef("");
  const fileInputRef = useRef(null);
  const rkScrollRef = useRef(null);
  const plainScrollRef = useRef(null);
  const doubleMode = isAdmin && viewMode === "double";

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
            { role: "assistant", content: t.assistant, plain: null, ts: t.ts || null },
          ])
        );
      } catch (e) {
        console.warn("session hydrate failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, session?.access_token, authHeader]);

  useEffect(() => {
    if (rkScrollRef.current) rkScrollRef.current.scrollTop = rkScrollRef.current.scrollHeight;
    if (plainScrollRef.current) plainScrollRef.current.scrollTop = plainScrollRef.current.scrollHeight;
  }, [messages, sending, doubleMode]);

  useEffect(() => {
    if (!isAdmin && viewMode !== "single") setViewMode("single");
  }, [isAdmin, viewMode]);

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
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      let transcriptText = "";
      for (let i = 0; i < event.results.length; i += 1) transcriptText += event.results[i][0]?.transcript || "";
      const spoken = transcriptText.trim();
      const base = speechBaseRef.current.trim();
      if (spoken) setText(base ? `${base} ${spoken}` : spoken);
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);
    return () => {
      try { recognition.stop(); } catch (_) { /* noop */ }
      recognitionRef.current = null;
    };
  }, []);

  const clearLocalChat = () => setMessages([]);

  const toggleSpeech = () => {
    if (!speechSupported || !recognitionRef.current) return;
    try {
      if (listening) recognitionRef.current.stop();
      else {
        speechBaseRef.current = text;
        recognitionRef.current.start();
      }
    } catch (_) { /* noop */ }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const attachFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const raw = await file.text();
      const truncated = raw.length > MAX_FILE_CHARS;
      const body = truncated ? raw.slice(0, MAX_FILE_CHARS) : raw;
      const fileBlock = `\n\n[Attached file: ${file.name}${truncated ? " · truncated" : ""}]\n\`\`\`\n${body}\n\`\`\``;
      setText((current) => `${current}${current.trim() ? "\n" : ""}${fileBlock}`.trimStart());
      setFileStatus(`${file.name}${truncated ? " attached, truncated" : " attached"}`);
      window.setTimeout(() => setFileStatus(""), 2400);
    } catch (_) {
      setFileStatus(`could not read ${file.name}`);
    }
  };

  const send = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    const requestDouble = doubleMode;
    setSending(true);
    setText("");
    setMessages((m) => [...m, { role: "user", content: msg, ts: new Date().toISOString() }]);

    try {
      const r = await axios.post(
        `${API}/chat`,
        { message: msg, target: requestDouble ? "both" : "rk_only" },
        { headers: authHeader, timeout: 45000 }
      );
      const d = r.data;
      const content = d.rk_response || d.plain_response || "";
      setMessages((m) => [...m, {
        role: "assistant",
        content,
        plain: requestDouble ? d.plain_response || "" : null,
        ts: new Date().toISOString(),
      }]);
    } catch (e) {
      const errMsg = `[ link to engine failed — ${e?.response?.data?.detail || e?.message || "unknown"} ]`;
      setMessages((m) => [...m, { role: "assistant", content: errMsg, plain: requestDouble ? errMsg : null, ts: new Date().toISOString() }]);
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
        pending = { user: m.content, userTs: m.ts, assistant: null, plain: null, assistantTs: null };
      } else if (pending) {
        pending.assistant = m.content;
        pending.plain = m.plain || null;
        pending.assistantTs = m.ts;
        out.push(pending);
        pending = null;
      } else {
        out.push({ user: null, userTs: null, assistant: m.content, plain: m.plain || null, assistantTs: m.ts });
      }
    }
    if (pending) out.push(pending);
    return out;
  }, [messages]);

  const fmtTs = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const formatThread = () => pairs.map((p) => [
    p.user && `You: ${p.user}`,
    p.plain && `CUS_SER_REP_1337: ${p.plain}`,
    p.assistant && `BRUNEL: ${p.assistant}`,
  ].filter(Boolean).join("\n\n")).filter(Boolean).join("\n\n---\n\n");

  const copyThread = async () => {
    await navigator.clipboard.writeText(formatThread());
    setCopiedKey("thread");
    setTimeout(() => setCopiedKey(null), 1200);
  };

  const renderPanelPairs = (kind) => (
    <div className="chat-body" ref={kind === "plain" ? plainScrollRef : rkScrollRef}>
      {pairs.length === 0 ? <div className="empty-state">waiting for prompt</div> : pairs.map((p, i) => (
        <div key={i} className="pair">
          {p.user && <div className="bubble bubble-user">{p.user}</div>}
          {kind === "plain" && p.plain && <div className="bubble bubble-plain">{p.plain}</div>}
          {kind === "rk" && p.assistant && <div className={`bubble bubble-assistant ${assistantVisualClass}`}>{p.assistant}</div>}
          {(p.assistantTs || p.userTs) && <div className="pair-timestamp">{fmtTs(p.assistantTs || p.userTs)}</div>}
        </div>
      ))}
      {sending && <div className="thinking">considering</div>}
    </div>
  );

  const renderSinglePairs = () => (
    <div className="chat-body" ref={rkScrollRef}>
      {pairs.length === 0 ? <div className="empty-state">say something — i'll remember it</div> : pairs.map((p, i) => (
        <div key={i} className="pair">
          {p.user && <div className="bubble bubble-user">{p.user}</div>}
          {p.assistant && <div className={`bubble bubble-assistant ${assistantVisualClass}`}>{p.assistant}</div>}
          {(p.assistantTs || p.userTs) && <div className="pair-timestamp">{fmtTs(p.assistantTs || p.userTs)}</div>}
        </div>
      ))}
      {sending && <div className="thinking">considering</div>}
    </div>
  );

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-name">BRUNEL</div>
          <div className="brand-sub">Powered by ARCHE</div>
        </div>

        <div className="topbar-right">
          <span className="session-id">{user?.email || "—"}</span>
          {isAdmin && (
            <div className="view-toggle">
              <button className={viewMode === "single" ? "active" : ""} onClick={() => setViewMode("single")}>Single</button>
              <button className={viewMode === "double" ? "active" : ""} onClick={() => setViewMode("double")}>Double</button>
            </div>
          )}
          <button className="reset-btn" onClick={clearLocalChat}><Trash2 size={11} /> Clear</button>
          <button className="reset-btn" onClick={copyThread} disabled={pairs.length === 0}><ClipboardCopy size={11} /> {copiedKey === "thread" ? "Copied" : "Copy"}</button>
          {isAdmin && <button className="reset-btn" onClick={() => navigate("/brunel/admin")}><Shield size={11} /> Admin</button>}
          <button className="reset-btn" onClick={() => signOut()}><LogOut size={11} /> Sign out</button>
        </div>
      </div>

      <div className={doubleMode ? "chat-grid double" : "chat-grid single"}>
        {doubleMode && (
          <div className="panel panel-plain">
            <div className="panel-title panel-title-plain">
              <div className="main-title">CUS_SER_REP_1337</div>
              <div className="sub-title">Conventional customer service entity</div>
            </div>
            {renderPanelPairs("plain")}
          </div>
        )}

        <div className={doubleMode ? "panel panel-rk" : "panel panel-rk solo"}>
          {doubleMode && (
            <div className="panel-title panel-title-rk">
              <div className="main-title"><span>BRUNEL</span><span className="powered">Powered by ARCHE</span></div>
              <div className="sub-title">Artificial Social Intelligence</div>
            </div>
          )}
          {doubleMode ? renderPanelPairs("rk") : renderSinglePairs()}
        </div>
      </div>

      <div className="panel-input shared-seed-box">
        <div className="speech-status">{fileStatus || (listening ? "listening… tap mic again to stop" : speechSupported ? "free speech input available" : "speech input unsupported here")}</div>
        <input ref={fileInputRef} className="hidden-file-input" type="file" accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.py,.css,.html,.log,.csv,.yml,.yaml,.xml,.sql,text/*,application/json" onChange={attachFile} />
        <div className="input-row">
          <textarea className="input" placeholder="Seed the same prompt..." value={text} disabled={sending} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
          <button className="file-btn" onClick={openFilePicker} disabled={sending} aria-label="attach file"><Paperclip size={14} /></button>
          <button className={`mic-btn ${listening ? "listening" : ""}`} onClick={toggleSpeech} disabled={sending} aria-label={listening ? "stop voice input" : "start voice input"}>{listening ? <MicOff size={14} /> : <Mic size={14} />}</button>
          <button className="send" onClick={send} disabled={sending || !text.trim()} aria-label="send"><Send size={14} /></button>
        </div>
      </div>

      <div className="footnote"><span>BRUNEL · An ArchePersona product</span><span className="footnote-tag">Powered by ARCHE</span></div>
    </div>
  );
}

export default Chat;
