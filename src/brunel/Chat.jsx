import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Send, LogOut, Shield, ClipboardCopy, Mic, MicOff, Paperclip, Trash2, Settings, X, Library } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import "./App.css";
import "./skins/skin-tokens.css";
import "./visible-ui-fix.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://brunel-5lxo.onrender.com";
const API = `${BACKEND_URL}/api`;
const DRAWER_ANIMATION_MS = 240;

const STATE_VISUALS = {
  St0: { label: "Baseline", className: "state-baseline" }, St1: { label: "Tender", className: "state-tender" }, St2: { label: "Eager", className: "state-eager" }, St3: { label: "Steady", className: "state-steady" }, St4: { label: "Reflective", className: "state-reflective" }, St5: { label: "Focused", className: "state-focused" }, St6: { label: "Guarded", className: "state-guarded" }, St7: { label: "Concerned", className: "state-concerned" }, St8: { label: "Restless", className: "state-restless" }, St9: { label: "Sharp", className: "state-sharp" },
};
const MODE_VISUALS = {
  "011": { label: "Companion", className: "mode-companion" }, "111": { label: "Assistant", className: "mode-assistant" }, "211": { label: "Hearth", className: "mode-hearth" }, "311": { label: "Creative", className: "mode-creative" }, "411": { label: "Research", className: "mode-research" }, "511": { label: "Tutor", className: "mode-tutor" }, "611": { label: "Operations", className: "mode-operations" }, "711": { label: "Technical", className: "mode-technical" }, "811": { label: "Sentinel", className: "mode-sentinel" }, "911": { label: "Emergency", className: "mode-emergency" },
};
const SKINS = [["desk","Desk"],["ledger","Ledger"],["phosphor","Phosphor"],["night-study","Night Study"],["fireplace","Fireplace"],["drafting-table","Drafting Table"],["cartographer","Cartographer"],["letterpress","Letterpress"],["tron","Tron"],["jarvis","Jarvis"]];
const MODELS = [["cheap","Cheap"],["smart","Smart"],["gemini","Gemini"],["deepseek","DeepSeek"],["qwen","Qwen"]];
const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const nowIso = () => new Date().toISOString();
const formatFileSize = (bytes = 0) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const formatAbsoluteTime = (iso) => { if (!iso) return ""; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : TIME_FORMATTER.format(d); };
const formatRelativeTime = (iso) => { if (!iso) return ""; const then = new Date(iso).getTime(); if (Number.isNaN(then)) return ""; const m = Math.floor((Date.now() - then) / 60000); if (m < 1) return "just now"; if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`; const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo ago`; return `${Math.floor(d / 365)}y ago`; };
const formatTimeLabel = (iso) => { const a = formatAbsoluteTime(iso); const r = formatRelativeTime(iso); return a ? `${a} · ${r}` : ""; };
const loadStoredSkin = () => { try { return window.localStorage.getItem("brunel-skin") || "desk"; } catch (_) { return "desk"; } };

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
  const [cybraryItems, setCybraryItems] = useState([]);
  const [attachedItem, setAttachedItem] = useState(null);
  const [viewMode, setViewMode] = useState("double");
  const [drawerKind, setDrawerKind] = useState(null);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [skin, setSkin] = useState(loadStoredSkin);
  const [selectedModel, setSelectedModel] = useState("cheap");
  const recognitionRef = useRef(null);
  const speechBaseRef = useRef("");
  const fileInputRef = useRef(null);
  const rkScrollRef = useRef(null);
  const plainScrollRef = useRef(null);
  const drawerTimerRef = useRef(null);
  const doubleMode = viewMode === "double";
  const authHeader = useMemo(() => (session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}), [session?.access_token]);

  useEffect(() => { try { window.localStorage.setItem("brunel-skin", skin); } catch (_) {} }, [skin]);
  useEffect(() => () => { if (drawerTimerRef.current) window.clearTimeout(drawerTimerRef.current); }, []);
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
    if (!session?.access_token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/cybrary/items`, { headers: authHeader });
        if (!cancelled) setCybraryItems((r.data.items || []).map((item) => ({ ...item, id: item.id || item.item_id, type: item.mime_type || item.type || item.kind })));
      } catch (_) { /* Cybrary backend may not be wired yet. */ }
    })();
    return () => { cancelled = true; };
  }, [session?.access_token, authHeader]);
  useEffect(() => { if (rkScrollRef.current) rkScrollRef.current.scrollTop = rkScrollRef.current.scrollHeight; if (plainScrollRef.current) plainScrollRef.current.scrollTop = plainScrollRef.current.scrollHeight; }, [messages, sending, doubleMode]);
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setSpeechSupported(false); return undefined; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.interimResults = true; recognition.lang = "en-US";
    recognition.onstart = () => setListening(true); recognition.onend = () => setListening(false); recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => { let out = ""; for (let i = 0; i < event.results.length; i += 1) out += event.results[i][0]?.transcript || ""; const spoken = out.trim(); const base = speechBaseRef.current.trim(); if (spoken) setText(base ? `${base} ${spoken}` : spoken); };
    recognitionRef.current = recognition; setSpeechSupported(true);
    return () => { try { recognition.stop(); } catch (_) {} recognitionRef.current = null; };
  }, []);

  const openDrawer = (kind) => { if (drawerTimerRef.current) window.clearTimeout(drawerTimerRef.current); setDrawerClosing(false); setDrawerKind(kind); };
  const closeDrawer = () => { if (!drawerKind || drawerClosing) return; setDrawerClosing(true); if (drawerTimerRef.current) window.clearTimeout(drawerTimerRef.current); drawerTimerRef.current = window.setTimeout(() => { setDrawerKind(null); setDrawerClosing(false); drawerTimerRef.current = null; }, DRAWER_ANIMATION_MS); };
  const getAssistantVisualClass = (message) => [STATE_VISUALS[message?.state || "St0"]?.className || STATE_VISUALS.St0.className, MODE_VISUALS[message?.mode || "011"]?.className || MODE_VISUALS["011"].className].join(" ");
  const clearLocalChat = () => setMessages([]);
  const toggleSpeech = () => { if (!speechSupported || !recognitionRef.current) return; try { if (listening) recognitionRef.current.stop(); else { speechBaseRef.current = text; recognitionRef.current.start(); } } catch (_) {} };
  const openFilePicker = () => fileInputRef.current?.click();
  const attachFile = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const localItem = { id: `cyb-local-${Date.now()}`, name: file.name, size: file.size, type: file.type || "file", source: "upload", created_at: nowIso(), status: "local", file };
    setFileStatus(`${file.name} entering Cybrary…`);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await axios.post(`${API}/cybrary/upload`, form, { headers: { ...authHeader, "Content-Type": "multipart/form-data" }, timeout: 45000 });
      const saved = { ...r.data, id: r.data.id || r.data.item_id, type: r.data.mime_type || r.data.type || r.data.kind, status: r.data.status || "stored" };
      setCybraryItems((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setAttachedItem(saved);
      setFileStatus(`${file.name} stored in Cybrary`);
    } catch (_) {
      setCybraryItems((items) => [localItem, ...items]);
      setAttachedItem(localItem);
      setFileStatus(`${file.name} staged locally for Cybrary`);
    }
    window.setTimeout(() => setFileStatus(""), 2400);
  };
  const send = async () => {
    const msg = text.trim(); if ((!msg && !attachedItem) || sending) return;
    const requestDouble = doubleMode; const userId = `user-${Date.now()}`; const assistantId = `assistant-${Date.now() + 1}`; const userTs = nowIso();
    const attachment = attachedItem ? { id: attachedItem.id, name: attachedItem.name, size: attachedItem.size, type: attachedItem.type || attachedItem.mime_type, source: "cybrary", status: attachedItem.status } : null;
    const outbound = attachment ? `${msg || "Please review the Cybrary item."}\n\n[Cybrary item attached: ${attachment.name} · ${formatFileSize(attachment.size)} · ${attachment.type} · ${attachment.id}]` : msg;
    setSending(true); setText(""); setAttachedItem(null); setMessages((m) => [...m, { id: userId, role: "user", content: msg || "Cybrary item attached", ts: userTs, attachment }]);
    try {
      const r = await axios.post(`${API}/chat`, { message: outbound, target: requestDouble ? "both" : "rk_only", model: selectedModel, client_ts: userTs, client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null, cybrary_item_ids: attachment ? [attachment.id] : [] }, { headers: authHeader, timeout: 45000 });
      const d = r.data; const content = d.rk_response || d.plain_response || ""; const assistantTs = d.ts || d.created_at || nowIso();
      setMessages((m) => [...m, { id: assistantId, role: "assistant", content, plain: requestDouble ? d.plain_response || "" : null, ts: assistantTs, state: d.current_state_id || "St0", mode: d.current_mode_id || "011" }]);
    } catch (e) {
      const errMsg = `[ link to engine failed — ${e?.response?.data?.detail || e?.message || "unknown"} ]`;
      setMessages((m) => [...m, { id: assistantId, role: "assistant", content: errMsg, plain: requestDouble ? errMsg : null, ts: nowIso(), state: "St0", mode: "011" }]);
    } finally { setSending(false); }
  };
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const pairs = useMemo(() => {
    const out = []; let pending = null;
    for (const m of messages) {
      if (m.role === "user") { if (pending) out.push(pending); pending = { user: m.content, userTs: m.ts, userAttachment: m.attachment || null, assistant: null, plain: null, assistantTs: null, assistantState: "St0", assistantMode: "011" }; }
      else if (pending) { pending.assistant = m.content; pending.plain = m.plain || null; pending.assistantTs = m.ts; pending.assistantState = m.state || "St0"; pending.assistantMode = m.mode || "011"; out.push(pending); pending = null; }
      else out.push({ user: null, userTs: null, userAttachment: null, assistant: m.content, plain: m.plain || null, assistantTs: m.ts, assistantState: m.state || "St0", assistantMode: "011" });
    }
    if (pending) out.push(pending); return out;
  }, [messages]);
  const fmtTs = (iso) => formatTimeLabel(iso);
  const formatThread = () => pairs.map((p) => [p.user && `[${fmtTs(p.userTs)}]\nYou: ${p.user}`, p.userAttachment && `[Cybrary item: ${p.userAttachment.name} · ${formatFileSize(p.userAttachment.size)}]`, p.plain && `[${fmtTs(p.assistantTs)}]\nPLAIN: ${p.plain}`, p.assistant && `[${fmtTs(p.assistantTs)}]\nBRUNEL: ${p.assistant}`].filter(Boolean).join("\n\n")).filter(Boolean).join("\n\n---\n\n");

  const renderResponseContent = (p) => {
    if (doubleMode) return (
      <div className="dual-response-grid">
        <div className={`response-panel brunel-panel ${getAssistantVisualClass({ state: p.assistantState, mode: p.assistantMode })}`}><div className="response-panel-title">BRUNEL</div><p>{p.assistant}</p></div>
        <div className="response-panel plain-panel"><div className="response-panel-title">Standard AI</div><p>{p.plain || "Waiting for comparison…"}</p></div>
      </div>
    );
    return <p className={getAssistantVisualClass({ state: p.assistantState, mode: p.assistantMode })}>{p.assistant}</p>;
  };

  return (
    <div className={`app-shell brunel-skin-${skin}`}>
      <header className="top-bar"><div><p className="eyebrow">ARCHEPersona</p><h1>BRUNEL</h1></div><div className="top-actions"><button onClick={() => setViewMode(doubleMode ? "single" : "double")}>{doubleMode ? "Single View" : "Dual View"}</button><button className="icon-btn" onClick={() => openDrawer("settings")} title="Settings"><Settings size={16} /></button>{isAdmin && <button className="admin-link" onClick={() => navigate("/admin")}><Shield size={16} />Admin</button>}<button onClick={signOut}><LogOut size={16} />Exit</button></div></header>
      <main className={`chat-layout ${doubleMode ? "double" : "single"}`}><section className="chat-card"><div className="conversation" ref={rkScrollRef}>{pairs.length === 0 && <div className="empty"><p>Start a conversation. Brunel will answer in comparison mode by default.</p></div>}{pairs.map((p, i) => <div className="exchange" key={`pair-${i}`}><div className="bubble user"><p>{p.user}</p>{p.userAttachment && <div className="attachment-chip"><Paperclip size={14} />{p.userAttachment.name} · {formatFileSize(p.userAttachment.size)}</div>}{p.userTs && <span className="timestamp">{fmtTs(p.userTs)}</span>}</div>{p.assistant && <div className="bubble assistant">{renderResponseContent(p)}{p.assistantTs && <span className="timestamp">{fmtTs(p.assistantTs)}</span>}</div>}</div>)}</div><div className="composer">{attachedItem && <div className="attachment-chip active"><Paperclip size={14} />{attachedItem.name} · {formatFileSize(attachedItem.size)}<button onClick={() => setAttachedItem(null)}><X size={12} /></button></div>}{fileStatus && <div className="file-status">{fileStatus}</div>}<textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder="Talk to Brunel…" /><input ref={fileInputRef} type="file" hidden onChange={attachFile} /><button onClick={openFilePicker} title="Attach file"><Paperclip size={18} /></button><button onClick={() => openDrawer("library")} title="Open Cybrary"><Library size={18} /></button><button onClick={toggleSpeech} disabled={!speechSupported} title="Voice input">{listening ? <MicOff size={18} /> : <Mic size={18} />}</button><button onClick={send} disabled={sending}><Send size={18} /></button><button onClick={() => navigator.clipboard.writeText(formatThread())} title="Copy transcript"><ClipboardCopy size={18} /></button><button onClick={clearLocalChat} title="Clear local chat"><Trash2 size={18} /></button></div></section></main>
      {drawerKind && <aside className={`side-drawer ${drawerClosing ? "closing" : "open"}`}><div className="drawer-head"><h3>{drawerKind === "settings" ? "Brunel Controls" : "Cybrary"}</h3><button onClick={closeDrawer}><X size={18} /></button></div>{drawerKind === "settings" ? <div className="drawer-body"><label>Skin<select value={skin} onChange={(e) => setSkin(e.target.value)}>{SKINS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>Model<select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>{MODELS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>View<select value={viewMode} onChange={(e) => setViewMode(e.target.value)}><option value="double">Dual View</option><option value="single">Single View</option></select></label></div> : <div className="drawer-body library-list">{cybraryItems.length === 0 ? <p>No Cybrary items yet.</p> : cybraryItems.map((item) => <button key={item.id} className="library-item" onClick={() => { setAttachedItem(item); closeDrawer(); }}><strong>{item.name}</strong><span>{item.kind || item.type} · {formatFileSize(item.size)} · {item.status || "stored"}</span></button>)}</div>}</aside>}
    </div>
  );
}

export default Chat;
