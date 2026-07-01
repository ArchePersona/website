import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Send, LogOut, Shield, ClipboardCopy, Mic, MicOff, Paperclip, Trash2, Settings, X, Library } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import { DEFAULT_MODEL_CHOICE, ADMIN_MODEL_CHOICES, normalizeModelChoice, modelChoiceLabel } from "./modelChoices.js";
import "./App.css";
import "./skins/skin-tokens.css";
import "./visible-ui-fix.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://brunel-5lxo.onrender.com";
const API = `${BACKEND_URL}/api`;
const DRAWER_ANIMATION_MS = 240;

const STATE_VISUALS = {
  "ST-0": { label: "Baseline", className: "state-baseline" }, "ST-1": { label: "Tender", className: "state-tender" }, "ST-2": { label: "Eager", className: "state-eager" }, "ST-3": { label: "Steady", className: "state-steady" }, "ST-4": { label: "Reflective", className: "state-reflective" }, "ST-5": { label: "Focused", className: "state-focused" }, "ST-6": { label: "Guarded", className: "state-guarded" }, "ST-7": { label: "Concerned", className: "state-concerned" }, "ST-8": { label: "Restless", className: "state-restless" }, "ST-9": { label: "Sharp", className: "state-sharp" },
  St0: { label: "Baseline", className: "state-baseline" }, St1: { label: "Tender", className: "state-tender" }, St2: { label: "Eager", className: "state-eager" }, St3: { label: "Steady", className: "state-steady" }, St4: { label: "Reflective", className: "state-reflective" }, St5: { label: "Focused", className: "state-focused" }, St6: { label: "Guarded", className: "state-guarded" }, St7: { label: "Concerned", className: "state-concerned" }, St8: { label: "Restless", className: "state-restless" }, St9: { label: "Sharp", className: "state-sharp" },
};
const MODE_VISUALS = {
  "011": { label: "Companion", className: "mode-companion" }, "111": { label: "Assistant", className: "mode-assistant" }, "211": { label: "Hearth", className: "mode-hearth" }, "311": { label: "Creative", className: "mode-creative" }, "411": { label: "Research", className: "mode-research" }, "511": { label: "Tutor", className: "mode-tutor" }, "611": { label: "Operations", className: "mode-operations" }, "711": { label: "Technical", className: "mode-technical" }, "811": { label: "Sentinel", className: "mode-sentinel" }, "911": { label: "Emergency", className: "mode-emergency" },
};
const ENGINE_BANDS = Array.from({ length: 10 }, (_, i) => 9 - i);
const ENGINE_BAND_COLORS = {
  0: "#246bff",
  1: "#168cff",
  2: "#00abc9",
  3: "#00b68a",
  4: "#4fc45a",
  5: "#a9c83f",
  6: "#f0d34a",
  7: "#f5a33b",
  8: "#ef6b2f",
  9: "#e23b35",
};
const STATE_INDEX_BY_ID = {
  Chuffed: 0,
  Warm: 1,
  Curious: 2,
  Reflective: 3,
  Steady: 4,
  Focused: 5,
  Skeptical: 6,
  Guarded: 7,
  Cross: 8,
  Shutdown: 9,
  Gentle: 1,
  Retreating: 3,
  Stuck: 6,
  Avoidant: 7,
  "ST-0": 0,
  "ST-1": 1,
  "ST-2": 2,
  "ST-3": 3,
  "ST-4": 4,
  "ST-5": 5,
  "ST-6": 6,
  "ST-7": 7,
  "ST-8": 8,
  "ST-9": 9,
  St0: 0,
  St1: 1,
  St2: 2,
  St3: 3,
  St4: 4,
  St5: 5,
  St6: 6,
  St7: 7,
  St8: 8,
  St9: 9,
};
const MODE_INDEX_BY_ID = {
  NORMAL: 0,
  RELATIONAL: 1,
  EXPLORATORY: 2,
  CLINICAL: 4,
  PROTECTIVE: 4,
  "011": 0,
  "111": 1,
  "211": 2,
  "311": 3,
  "411": 4,
  "511": 5,
  "611": 6,
  "711": 7,
  "811": 8,
  "911": 9,
};
const normalizeRuntimeIndex = (value, lookup, fallback = 0) => {
  if (value == null) return fallback;
  const direct = lookup[value];
  if (Number.isInteger(direct)) return direct;
  const upper = String(value).trim().toUpperCase();
  const normalized = lookup[upper];
  if (Number.isInteger(normalized)) return normalized;
  const digit = upper.match(/[0-9]/)?.[0];
  return digit ? Math.max(0, Math.min(9, Number(digit))) : fallback;
};
const getStateIndex = (state) => normalizeRuntimeIndex(state, STATE_INDEX_BY_ID, 4);
const getModeIndex = (mode) => normalizeRuntimeIndex(mode, MODE_INDEX_BY_ID, 0);
const getStateVisual = (state) => STATE_VISUALS[state] || STATE_VISUALS[`ST-${getStateIndex(state)}`] || STATE_VISUALS["ST-0"];
const getModeVisual = (mode) => MODE_VISUALS[mode] || MODE_VISUALS[`${getModeIndex(mode)}11`] || MODE_VISUALS["011"];
const SKINS = [["desk","Desk"],["ledger","Ledger"],["phosphor","Phosphor"],["night-study","Night Study"],["fireplace","Fireplace"],["drafting-table","Drafting Table"],["cartographer","Cartographer"],["letterpress","Letterpress"],["tron","Tron"],["jarvis","Jarvis"]];
const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const nowIso = () => new Date().toISOString();
const formatFileSize = (bytes = 0) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const formatAbsoluteTime = (iso) => { if (!iso) return ""; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : TIME_FORMATTER.format(d); };
const formatRelativeTime = (iso) => { if (!iso) return ""; const then = new Date(iso).getTime(); if (Number.isNaN(then)) return ""; const m = Math.floor((Date.now() - then) / 60000); if (m < 1) return "just now"; if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`; const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo ago`; return `${Math.floor(d / 365)}y ago`; };
const formatTimeLabel = (iso) => { const a = formatAbsoluteTime(iso); const r = formatRelativeTime(iso); return a ? `${a} · ${r}` : ""; };
const formatLatency = (ms) => { const n = Number(ms); if (!Number.isFinite(n) || n < 0) return ""; if (n < 1000) return `${Math.round(n)}ms`; if (n < 10000) return `${(n / 1000).toFixed(1)}s`; return `${Math.round(n / 1000)}s`; };
const loadStoredSkin = () => { try { return window.localStorage.getItem("brunel-skin") || "desk"; } catch (_) { return "desk"; } };
const loadStoredModel = () => { try { return normalizeModelChoice(window.localStorage.getItem("brunel-model")); } catch (_) { return DEFAULT_MODEL_CHOICE; } };
const loadInitialViewMode = () => { try { return window.matchMedia("(min-width: 901px)").matches ? "double" : "single"; } catch (_) { return "single"; } };
const stringifyEngineError = (value) => {
  if (!value) return "unknown";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringifyEngineError).filter(Boolean).join("; ") || "unknown";
  if (typeof value === "object") {
    return value.msg || value.message || value.error || value.detail || JSON.stringify(value);
  }
  return String(value);
};

function Chat() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  const sessionId = user?.id || "";
  const isAdmin = (user?.email || "").toLowerCase() === "archepersona@gmail.com";
  const [messages, setMessages] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [fileStatus, setFileStatus] = useState("");
  const [cybraryItems, setCybraryItems] = useState([]);
  const [attachedItem, setAttachedItem] = useState(null);
  const [viewMode, setViewMode] = useState(loadInitialViewMode);
  const [drawerKind, setDrawerKind] = useState(null);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [skin, setSkin] = useState(loadStoredSkin);
  const [selectedModel, setSelectedModel] = useState(loadStoredModel);
  const recognitionRef = useRef(null);
  const speechBaseRef = useRef("");
  const fileInputRef = useRef(null);
  const rkScrollRef = useRef(null);
  const plainScrollRef = useRef(null);
  const drawerTimerRef = useRef(null);
  const doubleMode = viewMode === "double";
  const authHeader = useMemo(() => (session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}), [session?.access_token]);

  useEffect(() => { try { window.localStorage.setItem("brunel-skin", skin); } catch (_) {} }, [skin]);
  useEffect(() => { if (!isAdmin) return; try { window.localStorage.setItem("brunel-model", normalizeModelChoice(selectedModel)); } catch (_) {} }, [isAdmin, selectedModel]);
  useEffect(() => () => { if (drawerTimerRef.current) window.clearTimeout(drawerTimerRef.current); }, []);
  useEffect(() => {
    if (!sessionId || !session?.access_token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/session/${sessionId}`, { headers: authHeader });
        if (cancelled) return;
        const d = r.data;
        setActiveThreadId(d.thread_id || null);
        setMessages((d.rk_history || []).flatMap((t, index) => [
          { id: `hydrated-user-${index}`, role: "user", content: t.user, ts: t.ts || null, attachment: t.attachment || null },
          { id: `hydrated-assistant-${index}`, role: "assistant", content: t.assistant, plain: null, ts: t.ts || null, state: t.current_state_id || t.state || "Steady", mode: t.current_mode_id || t.mode || "011", modelLabel: t.model_label || null, latencyMs: t.response_ms || t.latency_ms || null },
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
  const getAssistantVisualClass = (message) => [getStateVisual(message?.state).className, getModeVisual(message?.mode).className].join(" ");
  const startNewThread = async () => {
    if (!session?.access_token || sending) return;
    try {
      const r = await axios.post(`${API}/threads`, {}, { headers: authHeader, timeout: 15000 });
      setActiveThreadId(r.data.thread_id || null);
      setMessages([]);
      setText("");
      setAttachedItem(null);
      closeDrawer();
    } catch (e) { console.warn("new thread failed", e); }
  };
  const clearLocalChat = () => setMessages([]);
  const toggleSpeech = () => { if (!speechSupported || !recognitionRef.current) return; try { if (listening) recognitionRef.current.stop(); else { speechBaseRef.current = text; recognitionRef.current.start(); } } catch (_) {} };
  const openFilePicker = () => fileInputRef.current?.click();
  const attachFile = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const localItem = { id: `cyb-local-${Date.now()}`, name: file.name, size: file.size, type: file.type || "file", source: "upload", created_at: nowIso(), status: "local", file };
    setFileStatus(`${file.name} entering Cybrary…`);
    try {
      const form = new FormData(); form.append("file", file);
      const r = await axios.post(`${API}/cybrary/upload`, form, { headers: { ...authHeader, "Content-Type": "multipart/form-data" }, timeout: 45000 });
      const saved = { ...r.data, id: r.data.id || r.data.item_id, type: r.data.mime_type || r.data.type || r.data.kind, status: r.data.status || "stored" };
      setCybraryItems((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setAttachedItem(saved); setFileStatus(`${file.name} stored in Cybrary`);
    } catch (_) {
      setCybraryItems((items) => [localItem, ...items]); setAttachedItem(localItem); setFileStatus(`${file.name} staged locally for Cybrary`);
    }
    window.setTimeout(() => setFileStatus(""), 2400);
  };
  const send = async () => {
    const msg = text.trim(); if ((!msg && !attachedItem) || sending) return;
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const requestDouble = doubleMode; const userId = `user-${Date.now()}`; const assistantId = `assistant-${Date.now() + 1}`; const userTs = nowIso();
    const selectedModelKey = isAdmin ? normalizeModelChoice(selectedModel) : null;
    const selectedModelLabel = isAdmin ? modelChoiceLabel(selectedModelKey) : null;
    const attachment = attachedItem ? { id: attachedItem.id, name: attachedItem.name, size: attachedItem.size, type: attachedItem.type || attachedItem.mime_type, source: "cybrary", status: attachedItem.status } : null;
    const outbound = attachment ? `${msg || "Please review the Cybrary item."}\n\n[Cybrary item attached: ${attachment.name} · ${formatFileSize(attachment.size)} · ${attachment.type} · ${attachment.id}]` : msg;
    setSending(true); setText(""); setAttachedItem(null); setMessages((m) => [...m, { id: userId, role: "user", content: msg || "Cybrary item attached", ts: userTs, attachment }]);
    try {
      const r = await axios.post(`${API}/chat`, { message: outbound, thread_id: activeThreadId, target: requestDouble ? "both" : "rk_only", model: selectedModelKey, client_ts: userTs, client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null, cybrary_item_ids: attachment ? [attachment.id] : [] }, { headers: authHeader, timeout: 45000 });
      const elapsedMs = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt);
      const d = r.data; if (d.thread_id) setActiveThreadId(d.thread_id); const content = d.rk_response || d.plain_response || ""; const assistantTs = d.ts || d.created_at || nowIso(); const responseMs = Number(d.response_ms ?? d.latency_ms ?? elapsedMs);
      setMessages((m) => [...m, { id: assistantId, role: "assistant", content, plain: requestDouble ? d.plain_response || "" : null, ts: assistantTs, state: d.current_state_id || "Steady", mode: d.current_mode_id || "011", modelLabel: selectedModelLabel, latencyMs: responseMs }]);
    } catch (e) {
      const elapsedMs = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt);
      const detail = stringifyEngineError(e?.response?.data?.detail || e?.response?.data || e?.message);
      const errMsg = `[ link to engine failed — ${detail} ]`;
      setMessages((m) => [...m, { id: assistantId, role: "assistant", content: errMsg, plain: requestDouble ? errMsg : null, ts: nowIso(), state: "Steady", mode: "011", modelLabel: selectedModelLabel, latencyMs: elapsedMs }]);
    } finally { setSending(false); }
  };
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const pairs = useMemo(() => {
    const out = []; let pending = null;
    for (const m of messages) {
      if (m.role === "user") { if (pending) out.push(pending); pending = { user: m.content, userTs: m.ts, userAttachment: m.attachment || null, assistant: null, plain: null, assistantTs: null, assistantState: "Steady", assistantMode: "011", assistantModel: null, assistantLatencyMs: null }; }
      else if (pending) { pending.assistant = m.content; pending.plain = m.plain || null; pending.assistantTs = m.ts; pending.assistantState = m.state || "Steady"; pending.assistantMode = m.mode || "011"; pending.assistantModel = m.modelLabel || null; pending.assistantLatencyMs = m.latencyMs ?? null; out.push(pending); pending = null; }
      else out.push({ user: null, userTs: null, userAttachment: null, assistant: m.content, plain: m.plain || null, assistantTs: m.ts, assistantState: m.state || "Steady", assistantMode: m.mode || "011", assistantModel: m.modelLabel || null, assistantLatencyMs: m.latencyMs ?? null });
    }
    if (pending) out.push(pending); return out;
  }, [messages]);
  const latestRuntime = useMemo(() => {
    for (let i = pairs.length - 1; i >= 0; i -= 1) {
      if (pairs[i]?.assistant !== null) return { state: pairs[i].assistantState, mode: pairs[i].assistantMode };
    }
    return { state: "Steady", mode: "011" };
  }, [pairs]);
  const activeStateIndex = getStateIndex(latestRuntime.state);
  const activeModeIndex = getModeIndex(latestRuntime.mode);
  const renderEngineColumn = (label, activeIndex, maxLiveIndex = 9) => (
    <div className={`engine-column engine-column-${label.toLowerCase()}`} aria-label={`${label}${activeIndex}`} title={`${label}${activeIndex}`}>
      <div className="engine-column-label">{label}</div>
      <div className="engine-stack">
        {ENGINE_BANDS.map((band) => (
          <div
            key={`${label}-${band}`}
            className={`engine-band ${band === activeIndex ? "active" : ""} ${band > maxLiveIndex ? "reserved" : ""}`}
            style={{ "--band-color": ENGINE_BAND_COLORS[band] }}
          >
            {band}
          </div>
        ))}
      </div>
    </div>
  );
  const fmtTs = (iso) => formatTimeLabel(iso);
  const modelStamp = (p) => p.assistantModel || null;
  const replyStamp = (p) => p.assistantLatencyMs != null ? `R ${formatLatency(p.assistantLatencyMs)}` : null;
  const timestampLine = (p) => [modelStamp(p), fmtTs(p.assistantTs || p.userTs), replyStamp(p)].filter(Boolean).join(" · ");
  const formatThread = () => pairs.map((p) => [p.user && `[${fmtTs(p.userTs)}]\nYou: ${p.user}`, p.userAttachment && `[Cybrary item: ${p.userAttachment.name} · ${formatFileSize(p.userAttachment.size)}]`, p.plain && `[${timestampLine(p)}]\nStandard AI: ${p.plain}`, p.assistant && `[${timestampLine(p)}]\nBRUNEL: ${p.assistant}`].filter(Boolean).join("\n\n")).filter(Boolean).join("\n\n---\n\n");
  const copyThread = async () => { await navigator.clipboard.writeText(formatThread()); setCopiedKey("thread"); window.setTimeout(() => setCopiedKey(null), 1200); };

  const renderPanelPairs = (kind) => (
    <div className="chat-body" ref={kind === "plain" ? plainScrollRef : rkScrollRef}>
      {pairs.length === 0 ? <div className="empty-state">waiting for prompt</div> : pairs.map((p, i) => (
        <div key={i} className="pair">
          {p.user && <div className="bubble bubble-user">{p.user}{p.userAttachment && <div className="attachment-chip">{p.userAttachment.name} · {formatFileSize(p.userAttachment.size)}</div>}</div>}
          {kind === "plain" && p.plain && <div className="bubble bubble-plain">{p.plain}</div>}
          {kind === "rk" && p.assistant !== null && <div className={`bubble bubble-assistant ${getAssistantVisualClass({ state: p.assistantState, mode: p.assistantMode })}`}>{p.assistant}</div>}
          {(p.assistantModel || p.assistantTs || p.userTs || p.assistantLatencyMs != null) && <div className="pair-timestamp">{timestampLine(p)}</div>}
        </div>
      ))}
      {sending && <div className="thinking">considering</div>}
    </div>
  );
  const renderSinglePairs = () => (
    <div className="chat-body" ref={rkScrollRef}>
      {pairs.length === 0 ? <div className="empty-state">What are we working on?</div> : pairs.map((p, i) => (
        <div key={i} className="pair">
          {p.user && <div className="bubble bubble-user">{p.user}{p.userAttachment && <div className="attachment-chip">{p.userAttachment.name} · {formatFileSize(p.userAttachment.size)}</div>}</div>}
          {p.assistant !== null && <div className={`bubble bubble-assistant ${getAssistantVisualClass({ state: p.assistantState, mode: p.assistantMode })}`}>{p.assistant}</div>}
          {(p.assistantModel || p.assistantTs || p.userTs || p.assistantLatencyMs != null) && <div className="pair-timestamp">{timestampLine(p)}</div>}
        </div>
      ))}
      {sending && <div className="thinking">considering</div>}
    </div>
  );
  const renderBrunelInstrument = () => (
    <div className={doubleMode ? "rk-instrument-shell" : "rk-instrument-shell solo"}>
      {renderEngineColumn("M", activeModeIndex, 4)}
      <div className={doubleMode ? "panel panel-rk" : "panel panel-rk solo"}>{doubleMode && <div className="panel-title panel-title-rk"><div className="main-title"><span>BRUNEL</span><span className="powered">Powered by ARCHE</span></div><div className="sub-title">Artificial Behavioral Intelligence</div></div>}{doubleMode ? renderPanelPairs("rk") : renderSinglePairs()}</div>
      {renderEngineColumn("S", activeStateIndex, 9)}
    </div>
  );

  return (
    <div className="app" data-skin={skin}>
      <header className="topbar brunel-shell-topbar">
        <div className="topbar-left"><button className="drawer-toggle cybrary-toggle" onClick={() => openDrawer("library")} title="Cybrary"><Library size={18} /></button></div>
        <div className="brand brand-centered"><div className="brand-name">BRUNEL</div><div className="brand-sub">The Builder</div></div>
        <div className="topbar-right"><button className="drawer-toggle works-toggle" onClick={() => openDrawer("settings")} title="Settings"><Settings size={18} /></button></div>
      </header>

      <div className={doubleMode ? "chat-grid double" : "chat-grid single"}>
        {doubleMode && <div className="panel panel-plain"><div className="panel-title panel-title-plain"><div className="main-title">Standard AI</div><div className="sub-title">Baseline comparison</div></div>{renderPanelPairs("plain")}</div>}
        {renderBrunelInstrument()}
      </div>

      <div className="panel-input shared-seed-box">
        {attachedItem && <div className="attachment-chip active"><Paperclip size={14} />{attachedItem.name} · {formatFileSize(attachedItem.size)}<button onClick={() => setAttachedItem(null)}><X size={12} /></button></div>}
        {fileStatus && <div className="file-status">{fileStatus}</div>}
        <input ref={fileInputRef} className="hidden-file-input" type="file" onChange={attachFile} />
        <div className="input-row"><button className="file-btn" onClick={openFilePicker} disabled={sending} title="Attach"><Paperclip size={14} /></button><textarea className="input" placeholder="What are we working on?" value={text} disabled={sending} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} /><button className={`mic-btn ${listening ? "listening" : ""}`} onClick={toggleSpeech} disabled={sending || !speechSupported} title="Voice">{listening ? <MicOff size={14} /> : <Mic size={14} />}</button><button className="send" onClick={send} disabled={sending || (!text.trim() && !attachedItem)} title="Send"><Send size={14} /></button></div>
      </div>

      <div className="footnote"><span>BRUNEL · An ArchePersona product</span><span className="footnote-tag">Powered by ARCHE</span></div>

      {drawerKind && <><div className={`drawer-backdrop ${drawerClosing ? "closing" : "open"}`} onClick={closeDrawer} /><aside className={`drawer ${drawerKind === "library" ? "cybrary-drawer" : "works-drawer"} ${drawerClosing ? "closing" : "open"}`}><div className="drawer-title"><span>{drawerKind === "settings" ? "Brunel Controls" : "Cybrary"}</span><button className="drawer-close" onClick={closeDrawer}><X size={18} /></button></div>{drawerKind === "settings" ? <div className="drawer-row"><div className="drawer-section"><span className="drawer-label">Skin</span><select className="model-select" value={skin} onChange={(e) => setSkin(e.target.value)}>{SKINS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>{isAdmin && <div className="drawer-section"><span className="drawer-label">Model</span><select className="model-select" value={selectedModel} onChange={(e) => setSelectedModel(normalizeModelChoice(e.target.value))}>{ADMIN_MODEL_CHOICES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>}<div className="drawer-section"><span className="drawer-label">View</span><div className="view-toggle"><button className={viewMode === "single" ? "active" : ""} onClick={() => setViewMode("single")}>Single</button><button className={viewMode === "double" ? "active" : ""} onClick={() => setViewMode("double")}>Dual</button></div></div><button className="reset-btn" onClick={startNewThread} disabled={sending}><Trash2 size={13} />New Chat</button><button className="reset-btn" onClick={copyThread} disabled={pairs.length === 0}><ClipboardCopy size={13} />{copiedKey === "thread" ? "Copied" : "Copy"}</button>{isAdmin && <button className="reset-btn" onClick={() => navigate("/brunel/admin")}><Shield size={13} />Admin</button>}<button className="reset-btn" onClick={signOut}><LogOut size={13} />Exit</button></div> : <div className="drawer-row cybrary-list">{cybraryItems.length === 0 ? <p className="drawer-note">No Cybrary items yet.</p> : cybraryItems.map((item) => <button key={item.id} className="cybrary-item" onClick={() => { setAttachedItem(item); closeDrawer(); }}><span>{item.name}</span><small>{item.kind || item.type} · {formatFileSize(item.size)} · {item.status || "stored"}</small></button>)}</div>}</aside></>}
    </div>
  );
}

export default Chat;
