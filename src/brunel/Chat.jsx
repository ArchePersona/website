import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Send, LogOut, Shield, ClipboardCopy, Mic, MicOff, Paperclip, Trash2, Menu, X } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import "./App.css";
import "./skins/skin-tokens.css";
import "./visible-ui-fix.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://brunel-5lxo.onrender.com";
const API = `${BACKEND_URL}/api`;

const STATE_VISUALS = {
  St0: { label: "Baseline", className: "state-baseline" },
  St1: { label: "Tender", className: "state-tender" },
  St2: { label: "Eager", className: "state-eager" },
  St3: { label: "Steady", className: "state-steady" },
  St4: { label: "Reflective", className: "state-reflective" },
  St5: { label: "Focused", className: "state-focused" },
  St6: { label: "Guarded", className: "state-guarded" },
  St7: { label: "Concerned", className: "state-concerned" },
  St8: { label: "Restless", className: "state-restless" },
  St9: { label: "Sharp", className: "state-sharp" },
};

const MODE_VISUALS = {
  "011": { label: "Companion", className: "mode-companion" },
  "111": { label: "Assistant", className: "mode-assistant" },
  "211": { label: "Hearth", className: "mode-hearth" },
  "311": { label: "Creative", className: "mode-creative" },
  "411": { label: "Research", className: "mode-research" },
  "511": { label: "Tutor", className: "mode-tutor" },
  "611": { label: "Operations", className: "mode-operations" },
  "711": { label: "Technical", className: "mode-technical" },
  "811": { label: "Sentinel", className: "mode-sentinel" },
  "911": { label: "Emergency", className: "mode-emergency" },
};

const SKINS = [
  ["desk", "Desk"],
  ["ledger", "Ledger"],
  ["phosphor", "Phosphor"],
  ["night-study", "Night Study"],
  ["fireplace", "Fireplace"],
  ["drafting-table", "Drafting Table"],
  ["cartographer", "Cartographer"],
  ["letterpress", "Letterpress"],
  ["tron", "Tron"],
  ["jarvis", "Jarvis"],
];

const MODELS = [
  ["cheap", "Cheap"],
  ["smart", "Smart"],
  ["gemini", "Gemini"],
  ["deepseek", "DeepSeek"],
  ["qwen", "Qwen"],
];

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const nowIso = () => new Date().toISOString();

const formatFileSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatAbsoluteTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return TIME_FORMATTER.format(d);
};

const formatRelativeTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const then = d.getTime();
  if (Number.isNaN(then)) return "";
  const deltaMs = Date.now() - then;
  if (deltaMs < 0) return "now";
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

const formatTimeLabel = (iso) => {
  const absolute = formatAbsoluteTime(iso);
  const relative = formatRelativeTime(iso);
  if (!absolute) return "";
  return relative ? `${absolute} · ${relative}` : absolute;
};

const loadStoredSkin = () => {
  try { return window.localStorage.getItem("brunel-skin") || "desk"; }
  catch (_) { return "desk"; }
};

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
  const [attachedFile, setAttachedFile] = useState(null);
  const [viewMode, setViewMode] = useState("single");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [skin, setSkin] = useState(loadStoredSkin);
  const [selectedModel, setSelectedModel] = useState("cheap");

  const recognitionRef = useRef(null);
  const speechBaseRef = useRef("");
  const fileInputRef = useRef(null);
  const rkScrollRef = useRef(null);
  const plainScrollRef = useRef(null);

  const doubleMode = isAdmin && viewMode === "double";
  const authHeader = useMemo(() => (session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}), [session?.access_token]);

  useEffect(() => { try { window.localStorage.setItem("brunel-skin", skin); } catch (_) { /* noop */ } }, [skin]);

  useEffect(() => {
    if (!sessionId || !session?.access_token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/session/${sessionId}`, { headers: authHeader });
        if (cancelled) return;
        const d = r.data;
        setMessages((d.rk_history || []).flatMap((t, index) => [
          { id: `hydrated-user-${index}`, role: "user", content: t.user, ts: t.ts || null, attachment: t.attachment || null },
          { id: `hydrated-assistant-${index}`, role: "assistant", content: t.assistant, plain: null, ts: t.ts || null, state: t.current_state_id || "St0", mode: t.current_mode_id || "011" },
        ]));
      } catch (e) { console.warn("session hydrate failed", e); }
    })();
    return () => { cancelled = true; };
  }, [sessionId, session?.access_token, authHeader]);

  useEffect(() => {
    if (rkScrollRef.current) rkScrollRef.current.scrollTop = rkScrollRef.current.scrollHeight;
    if (plainScrollRef.current) plainScrollRef.current.scrollTop = plainScrollRef.current.scrollHeight;
  }, [messages, sending, doubleMode]);

  useEffect(() => { if (!isAdmin && viewMode !== "single") setViewMode("single"); }, [isAdmin, viewMode]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setSpeechSupported(false); return undefined; }
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
    return () => { try { recognition.stop(); } catch (_) { /* noop */ } recognitionRef.current = null; };
  }, []);

  const getAssistantVisualClass = (message) => {
    const stateKey = message?.state || "St0";
    const modeKey = message?.mode || "011";
    return [STATE_VISUALS[stateKey]?.className || STATE_VISUALS.St0.className, MODE_VISUALS[modeKey]?.className || MODE_VISUALS["011"].className].join(" ");
  };

  const clearLocalChat = () => setMessages([]);

  const toggleSpeech = () => {
    if (!speechSupported || !recognitionRef.current) return;
    try {
      if (listening) recognitionRef.current.stop();
      else { speechBaseRef.current = text; recognitionRef.current.start(); }
    } catch (_) { /* noop */ }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const attachFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAttachedFile({ file, name: file.name, size: file.size, type: file.type || "file" });
    setFileStatus(`${file.name} attached as file`);
    window.setTimeout(() => setFileStatus(""), 2400);
  };

  const send = async () => {
    const msg = text.trim();
    if ((!msg && !attachedFile) || sending) return;
    const requestDouble = doubleMode;
    const userId = `user-${Date.now()}`;
    const assistantId = `assistant-${Date.now() + 1}`;
    const userTs = nowIso();
    const attachment = attachedFile ? { name: attachedFile.name, size: attachedFile.size, type: attachedFile.type } : null;
    const outbound = attachment
      ? `${msg || "Please review the attached file."}\n\n[Attached file retained: ${attachment.name} · ${formatFileSize(attachment.size)} · ${attachment.type}]`
      : msg;

    setSending(true);
    setText("");
    setAttachedFile(null);
    setMessages((m) => [...m, { id: userId, role: "user", content: msg || "Attached file", ts: userTs, attachment }]);
    try {
      const r = await axios.post(`${API}/chat`, { message: outbound, target: requestDouble ? "both" : "rk_only", model: selectedModel, client_ts: userTs, client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null, attachment }, { headers: authHeader, timeout: 45000 });
      const d = r.data;
      const content = d.rk_response || d.plain_response || "";
      const assistantTs = d.ts || d.created_at || nowIso();
      setMessages((m) => [...m, { id: assistantId, role: "assistant", content, plain: requestDouble ? d.plain_response || "" : null, ts: assistantTs, state: d.current_state_id || "St0", mode: d.current_mode_id || "011" }]);
    } catch (e) {
      const errMsg = `[ link to engine failed — ${e?.response?.data?.detail || e?.message || "unknown"} ]`;
      setMessages((m) => [...m, { id: assistantId, role: "assistant", content: errMsg, plain: requestDouble ? errMsg : null, ts: nowIso(), state: "St0", mode: "011" }]);
    } finally { setSending(false); }
  };

  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const pairs = useMemo(() => {
    const out = [];
    let pending = null;
    for (const m of messages) {
      if (m.role === "user") {
        if (pending) out.push(pending);
        pending = { user: m.content, userTs: m.ts, userAttachment: m.attachment || null, assistant: null, plain: null, assistantTs: null, assistantState: "St0", assistantMode: "011" };
      } else if (pending) {
        pending.assistant = m.content;
        pending.plain = m.plain || null;
        pending.assistantTs = m.ts;
        pending.assistantState = m.state || "St0";
        pending.assistantMode = m.mode || "011";
        out.push(pending);
        pending = null;
      } else {
        out.push({ user: null, userTs: null, userAttachment: null, assistant: m.content, plain: m.plain || null, assistantTs: m.ts, assistantState: m.state || "St0", assistantMode: m.mode || "011" });
      }
    }
    if (pending) out.push(pending);
    return out;
  }, [messages]);

  const fmtTs = (iso) => formatTimeLabel(iso);
  const formatThread = () => pairs.map((p) => [p.user && `[${fmtTs(p.userTs)}]\nYou: ${p.user}`, p.userAttachment && `[Attached file: ${p.userAttachment.name} · ${formatFileSize(p.userAttachment.size)}]`, p.plain && `[${fmtTs(p.assistantTs)}]\nPLAIN: ${p.plain}`, p.assistant && `[${fmtTs(p.assistantTs)}]\nBRUNEL: ${p.assistant}`].filter(Boolean).join("\n\n")).filter(Boolean).join("\n\n---\n\n");
  const copyThread = async () => { await navigator.clipboard.writeText(formatThread()); setCopiedKey("thread"); setTimeout(() => setCopiedKey(null), 1200); };

  const renderAttachmentChip = (attachment) => attachment && (
    <div className="attachment-chip"><Paperclip size={12} /><span>{attachment.name}</span><small>{formatFileSize(attachment.size)}</small></div>
  );

  const renderPanelPairs = (kind) => (
    <div className="chat-body" ref={kind === "plain" ? plainScrollRef : rkScrollRef}>
      {pairs.length === 0 ? <div className="empty-state">Good afternoon. What are we working on?</div> : pairs.map((p, i) => (
        <div key={i} className="pair">
          {p.user && <div className="bubble bubble-user">{p.user}{renderAttachmentChip(p.userAttachment)}</div>}
          {kind === "plain" && p.plain && <div className="bubble bubble-plain">{p.plain}</div>}
          {kind === "rk" && p.assistant !== null && <div className={`bubble bubble-assistant ${getAssistantVisualClass({ state: p.assistantState, mode: p.assistantMode })}`}>{p.assistant}</div>}
          {(p.assistantTs || p.userTs) && <div className="pair-timestamp">{fmtTs(p.assistantTs || p.userTs)}</div>}
        </div>
      ))}
      {sending && <div className="thinking">considering</div>}
    </div>
  );

  const renderSinglePairs = () => (
    <div className="chat-body" ref={rkScrollRef}>
      {pairs.length === 0 ? <div className="empty-state">Good afternoon. What are we working on?</div> : pairs.map((p, i) => (
        <div key={i} className="pair">
          {p.user && <div className="bubble bubble-user">{p.user}{renderAttachmentChip(p.userAttachment)}</div>}
          {p.assistant !== null && <div className={`bubble bubble-assistant ${getAssistantVisualClass({ state: p.assistantState, mode: p.assistantMode })}`}>{p.assistant}</div>}
          {(p.assistantTs || p.userTs) && <div className="pair-timestamp">{fmtTs(p.assistantTs || p.userTs)}</div>}
        </div>
      ))}
      {sending && <div className="thinking">considering</div>}
    </div>
  );

  return (
    <div className="app" data-skin={skin}>
      <div className="topbar">
        <div className="brand"><div className="brand-name">BRUNEL</div><div className="brand-sub">The Builder</div></div>
        <div className="topbar-right"><button className="drawer-toggle" onClick={() => setDrawerOpen(true)} aria-label="open menu"><Menu size={16} /></button></div>
      </div>

      {drawerOpen && <><div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} /><div className="drawer">
        <div className="drawer-title"><span>Study</span><button className="drawer-close" onClick={() => setDrawerOpen(false)} aria-label="close menu"><X size={16} /></button></div>
        <div className="drawer-section"><div className="drawer-label">Account</div><span className="session-id">{user?.email || "—"}</span></div>
        <div className="drawer-section"><div className="drawer-label">Model</div><select className="model-select" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} disabled={sending} aria-label="select runtime model">{MODELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="drawer-section"><div className="drawer-label">Skin</div><select className="model-select" value={skin} onChange={(e) => setSkin(e.target.value)} aria-label="select skin">{SKINS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {isAdmin && <div className="drawer-section"><div className="drawer-label">View</div><div className="view-toggle"><button className={viewMode === "single" ? "active" : ""} onClick={() => setViewMode("single")}>Single</button><button className={viewMode === "double" ? "active" : ""} onClick={() => setViewMode("double")}>Double</button></div></div>}
        <div className="drawer-section"><div className="drawer-label">Archive</div><div className="drawer-row"><button className="reset-btn" onClick={copyThread} disabled={pairs.length === 0}><ClipboardCopy size={11} /> {copiedKey === "thread" ? "Copied" : "Copy thread"}</button><button className="reset-btn" onClick={clearLocalChat}><Trash2 size={11} /> Clear</button></div></div>
        <div className="drawer-section"><div className="drawer-label">Admin</div><div className="drawer-row">{isAdmin && <button className="reset-btn" onClick={() => navigate("/brunel/admin")}><Shield size={11} /> Admin panel</button>}<button className="reset-btn" onClick={() => signOut()}><LogOut size={11} /> Sign out</button></div></div>
      </div></>}

      <div className={doubleMode ? "chat-grid double" : "chat-grid single"}>
        {doubleMode && <div className="panel panel-plain"><div className="panel-title panel-title-plain"><div className="main-title">PLAIN</div><div className="sub-title">Control response</div></div>{renderPanelPairs("plain")}</div>}
        <div className={doubleMode ? "panel panel-rk" : "panel panel-rk solo"}>{doubleMode && <div className="panel-title panel-title-rk"><div className="main-title"><span>BRUNEL</span><span className="powered">Powered by ARCHEngine</span></div><div className="sub-title">Artificial Behavioral Intelligence</div></div>}{doubleMode ? renderPanelPairs("rk") : renderSinglePairs()}</div>
      </div>

      <div className="panel-input shared-seed-box">
        <div className="speech-status">{fileStatus || (speechSupported ? "" : "speech input unsupported here")}</div>
        {attachedFile && <div className="attachment-row">{renderAttachmentChip(attachedFile)}<button type="button" onClick={() => setAttachedFile(null)} aria-label="remove attached file">×</button></div>}
        <input ref={fileInputRef} className="hidden-file-input" type="file" onChange={attachFile} />
        <div className="input-row"><button className="file-btn" onClick={openFilePicker} disabled={sending} aria-label="attach file" title="Attach file"><Paperclip size={14} /></button><textarea className="input" placeholder={doubleMode ? "Seed the same prompt..." : "What are we working on?"} value={text} disabled={sending} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} /><button className={`mic-btn ${listening ? "listening" : ""}`} onClick={toggleSpeech} disabled={sending} aria-label={listening ? "stop voice input" : "start voice input"} title={listening ? "Stop voice input" : "Start voice input"}>{listening ? <MicOff size={14} /> : <Mic size={14} />}</button><button className="send" onClick={send} disabled={sending || (!text.trim() && !attachedFile)} aria-label="send"><Send size={14} /></button></div>
      </div>
      <div className="footnote"><span>BRUNEL · An ArchePersona product</span><span className="footnote-tag">Powered by ARCHE</span></div>
    </div>
  );
}

export default Chat;
