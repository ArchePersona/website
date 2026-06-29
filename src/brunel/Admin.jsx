import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext.jsx';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://brunel-5lxo.onrender.com';
const API = `${BACKEND_URL}/api`;

const DEFAULT_RUNTIME_FLAGS = {
  memory_live_path: false,
  chronological_recall_live_path: true,
  persona_packet_live_path: true,
  prompt_history_turns: 0,
  temporal_prompt_path: false,
  reflection_prompt_path: false,
  context_prompt_path: false,
  transcript_prompt_path: false,
  mediator_prompt_path: true,
};

const FLAG_LABELS = [
  ['memory_live_path', 'Memory live path'],
  ['chronological_recall_live_path', 'Chronological recall'],
  ['persona_packet_live_path', 'Persona packet'],
  ['temporal_prompt_path', 'Temporal prompt'],
  ['reflection_prompt_path', 'Reflection prompt'],
  ['context_prompt_path', 'Context prompt'],
  ['transcript_prompt_path', 'Transcript prompt'],
  ['mediator_prompt_path', 'Mediator posture'],
];

const INSPECTION_CARD_DEFAULTS = {
  system: true,
  recall: false,
  persona: false,
  memoryBody: false,
  activeSeed: false,
  memory: false,
  broker: false,
  promptBuilder: false,
  promptWindow: false,
  promptSections: false,
  session: false,
  runtime: false,
};

const CSS = `
.engine-admin { min-height: 100dvh; overflow-y: auto; padding: 10px; background: #05080b; color: #e8fff0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.engine-admin-topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; border-bottom: 1px solid rgba(80,255,150,0.22); padding-bottom: 10px; margin-bottom: 10px; }
.engine-brand-name { color: #d7b35a; font-size: 19px; letter-spacing: 0.22em; }
.engine-brand-sub { color: #7dffae; font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; margin-top: 4px; }
.engine-admin-actions, .engine-button-row, .engine-card-actions, .value-grid, .egress-stack, .engine-tabs, .engine-health-strip { display: flex; flex-wrap: wrap; gap: 6px; }
.engine-grid, .engine-controls-grid, .engine-overview-grid, .engine-trace-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 10px; }
.engine-section-label { color: rgba(232,255,240,0.56); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; margin: 10px 0 7px; }
.engine-tabs { margin: 8px 0 10px; position: sticky; top: 0; z-index: 4; background: rgba(5,8,11,0.96); padding: 6px 0; }
.engine-tab { background: transparent; border: 1px solid rgba(80,255,150,0.24); color: rgba(232,255,240,0.64); font: inherit; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; padding: 8px 10px; cursor: pointer; }
.engine-tab[data-active='true'] { color: #d7b35a; border-color: rgba(215,179,90,0.62); background: rgba(215,179,90,0.08); }
.engine-card { grid-column: span 6; border: 1px solid rgba(80,255,150,0.18); background: rgba(8,14,20,0.92); min-width: 0; }
.engine-card-wide { grid-column: span 12; }
.engine-card[data-tone='control'] { border-color: rgba(215,179,90,0.42); background: rgba(20,16,8,0.92); }
.engine-card[data-tone='control'] .engine-card-title, .engine-card[data-tone='control'] .engine-card-caret { color: #d7b35a; }
.engine-card[data-tone='memory'] { border-color: rgba(78,164,255,0.34); background: rgba(7,13,23,0.92); }
.engine-card[data-tone='memory'] .engine-card-title, .engine-card[data-tone='memory'] .engine-card-caret { color: #8fc5ff; }
.engine-card[data-tone='warning'] { border-color: rgba(255,100,100,0.34); background: rgba(23,8,9,0.92); }
.engine-card[data-tone='warning'] .engine-card-title, .engine-card[data-tone='warning'] .engine-card-caret { color: #ff9090; }
.engine-card-head { display: flex; justify-content: space-between; gap: 8px; padding: 8px 10px; border-bottom: 1px solid rgba(80,255,150,0.12); background: rgba(80,255,150,0.035); }
.engine-card-head[data-collapsible='true'] { cursor: pointer; }
.engine-card-title-row { display: flex; align-items: center; gap: 8px; }
.engine-card-caret { color: #d7b35a; font-size: 10px; min-width: 12px; }
.engine-card-title { color: #7dffae; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; }
.engine-card-subtitle { color: rgba(232,255,240,0.58); font-size: 9px; margin-top: 3px; line-height: 1.25; }
.engine-card-body { padding: 10px; }
.engine-card-collapsed { display: none; }
.engine-btn, .engine-mini-btn { background: transparent; border: 1px solid rgba(80,255,150,0.24); color: #7dffae; font: inherit; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; padding: 7px 9px; cursor: pointer; }
.engine-mini-btn { padding: 5px 8px; font-size: 8px; align-self: center; }
.engine-btn-primary { border-color: #d7b35a; color: #d7b35a; }
.engine-btn-dim { color: rgba(232,255,240,0.56); border-color: rgba(232,255,240,0.16); }
.engine-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.engine-message { border: 1px solid rgba(215,179,90,0.5); color: #d7b35a; background: rgba(215,179,90,0.08); padding: 8px 10px; margin-bottom: 10px; font-size: 10px; }
.value-chip, .egress-chip { display: inline-flex; border: 1px solid rgba(232,255,240,0.14); color: rgba(232,255,240,0.72); background: rgba(255,255,255,0.025); padding: 4px 7px; font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; }
.value-chip strong { color: #7dffae; margin-left: 6px; }
.egress-chip[data-active='true'] { color: #7dffae; border-color: rgba(80,255,150,0.3); background: rgba(80,255,150,0.06); }
.engine-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.engine-field, .engine-control-row label { display: flex; flex-direction: column; gap: 6px; color: rgba(232,255,240,0.68); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; }
.engine-field input { background: rgba(0,0,0,0.32); border: 1px solid rgba(232,255,240,0.16); color: #fff; padding: 8px 9px; font: inherit; }
.engine-control-row input[type='range'] { width: 100%; accent-color: #7dffae; }
.engine-control-row strong { color: #7dffae; font-size: 20px; }
.engine-toggle-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.engine-toggle { text-align: left; background: rgba(255,255,255,0.02); border: 1px solid rgba(232,255,240,0.14); color: rgba(232,255,240,0.68); font: inherit; padding: 8px; cursor: pointer; }
.engine-toggle[data-active='true'] { color: #7dffae; border-color: rgba(80,255,150,0.5); background: rgba(80,255,150,0.08); }
.engine-json { white-space: pre-wrap; word-break: break-word; overflow: auto; background: rgba(0,0,0,0.42); color: #e8fff0; border: 1px solid rgba(232,255,240,0.12); padding: 10px; font-size: 11px; line-height: 1.5; }
.engine-hero { grid-column: span 12; border: 1px solid rgba(215,179,90,0.36); background: radial-gradient(circle at top left, rgba(215,179,90,0.14), rgba(8,14,20,0.96) 44%); padding: 12px; }
.engine-hero-title { color: #d7b35a; font-size: 22px; letter-spacing: 0.24em; margin-bottom: 8px; }
.engine-hero-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.engine-stat { border: 1px solid rgba(232,255,240,0.12); background: rgba(0,0,0,0.24); padding: 8px; }
.engine-stat-label { color: rgba(232,255,240,0.52); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; }
.engine-stat-value { color: #7dffae; font-size: 16px; margin-top: 4px; overflow-wrap: anywhere; }
.engine-readable-row { display: grid; grid-template-columns: 108px 1fr; gap: 8px; border-bottom: 1px solid rgba(232,255,240,0.08); padding: 6px 0; }
.engine-readable-label { color: rgba(232,255,240,0.48); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; }
.engine-readable-value { color: rgba(232,255,240,0.84); font-size: 11px; line-height: 1.35; }
.engine-health-item { flex: 1 1 130px; border: 1px solid rgba(232,255,240,0.12); padding: 7px; background: rgba(0,0,0,0.24); }
.engine-health-top { display: flex; justify-content: space-between; gap: 8px; color: rgba(232,255,240,0.62); font-size: 8px; text-transform: uppercase; letter-spacing: 0.12em; }
.engine-bar { height: 5px; border: 1px solid rgba(232,255,240,0.16); margin-top: 6px; background: rgba(255,255,255,0.05); }
.engine-bar-fill { height: 100%; background: #7dffae; }
.engine-trace-step { grid-column: span 12; border-left: 2px solid rgba(215,179,90,0.7); padding: 8px 10px; background: rgba(8,14,20,0.86); border: 1px solid rgba(80,255,150,0.14); }
.engine-trace-title { color: #d7b35a; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; }
.engine-trace-text { color: rgba(232,255,240,0.72); font-size: 10px; line-height: 1.4; margin-top: 5px; }
.engine-influence-row { display: grid; grid-template-columns: 86px 1fr 36px; gap: 8px; align-items: center; margin: 7px 0; }
.engine-influence-label, .engine-influence-value { color: rgba(232,255,240,0.72); font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; }
@media (max-width: 900px) { .engine-admin { padding: 8px; } .engine-admin-topbar { flex-direction: column; } .engine-card, .engine-card-wide { grid-column: span 12; } .engine-two-col, .engine-toggle-grid, .engine-hero-grid { grid-template-columns: 1fr; } .engine-card-head { padding: 8px 9px; } .engine-card-body { padding: 9px; } }
`;

function normalizeFlags(flags) { return { ...DEFAULT_RUNTIME_FLAGS, ...(flags || {}) }; }
function safeJson(value) { try { return JSON.stringify(value ?? {}, null, 2); } catch (_) { return '{}'; } }
function bytes(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, idx)).toFixed(idx ? 1 : 0)} ${units[idx]}`;
}
function clampPct(value) { return Math.max(0, Math.min(100, Math.round(Number(value) || 0))); }
function Card({ title, subtitle, children, wide = false, copyValue, onCopy, collapsible = true, open = true, onToggle, tone = 'runtime' }) {
  const actions = copyValue === undefined ? null : <button className="engine-mini-btn" onClick={(event) => { event.stopPropagation(); onCopy(title, copyValue); }}>Copy</button>;
  return <section className={`engine-card${wide ? ' engine-card-wide' : ''}`} data-tone={tone}><div className="engine-card-head" data-collapsible={collapsible ? 'true' : 'false'} onClick={collapsible ? onToggle : undefined}><div><div className="engine-card-title-row"><span className="engine-card-caret">{collapsible ? (open ? '▾' : '▸') : ''}</span><div className="engine-card-title">{title}</div></div>{subtitle && <div className="engine-card-subtitle">{subtitle}</div>}</div><div className="engine-card-actions">{actions}</div></div><div className={`engine-card-body${collapsible && !open ? ' engine-card-collapsed' : ''}`}>{children}</div></section>;
}
function Chip({ label, value }) { return <span className="value-chip">{label}<strong>{String(value ?? '—')}</strong></span>; }
function JsonPanel({ value, maxHeight = 340 }) { return <pre className="engine-json" style={{ maxHeight }}>{safeJson(value)}</pre>; }
function Stat({ label, value }) { return <div className="engine-stat"><div className="engine-stat-label">{label}</div><div className="engine-stat-value">{String(value ?? '—')}</div></div>; }
function ReadRow({ label, value }) { return <div className="engine-readable-row"><div className="engine-readable-label">{label}</div><div className="engine-readable-value">{String(value ?? '—')}</div></div>; }
function HealthItem({ label, value, score }) { return <div className="engine-health-item"><div className="engine-health-top"><span>{label}</span><span>{value}</span></div><div className="engine-bar"><div className="engine-bar-fill" style={{ width: `${clampPct(score)}%` }} /></div></div>; }
function InfluenceRow({ label, value }) { return <div className="engine-influence-row"><div className="engine-influence-label">{label}</div><div className="engine-bar"><div className="engine-bar-fill" style={{ width: `${clampPct(value)}%` }} /></div><div className="engine-influence-value">{clampPct(value)}%</div></div>; }
function TraceStep({ title, text, active = true }) { return <div className="engine-trace-step"><div className="engine-trace-title">{active ? '✓ ' : '○ '}{title}</div><div className="engine-trace-text">{text}</div></div>; }

export default function Admin() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  const authHeader = useMemo(() => (session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}), [session?.access_token]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [engineConfig, setEngineConfig] = useState(null);
  const [runtimeLast, setRuntimeLast] = useState(null);
  const [memoryStatus, setMemoryStatus] = useState(null);
  const [sessionDoc, setSessionDoc] = useState(null);
  const [packetVolume, setPacketVolume] = useState(0);
  const [pickState, setPickState] = useState('');
  const [pickMode, setPickMode] = useState('');
  const [runtimeFlags, setRuntimeFlags] = useState(DEFAULT_RUNTIME_FLAGS);
  const [openCards, setOpenCards] = useState(INSPECTION_CARD_DEFAULTS);
  const [viewMode, setViewMode] = useState('overview');

  const runtime = runtimeLast?.runtime || {};
  const statePacket = runtime.state || {};
  const pressurePacket = runtime.pressure || {};
  const pressure = pressurePacket.pressure || pressurePacket || {};
  const personaPacket = runtime.persona || sessionDoc?.last_persona_packet || {};
  const memoryPacket = runtime.memory || {};
  const recallPacket = memoryPacket.chronological_recall || sessionDoc?.last_chronological_recall || {};
  const brokerPacket = runtime.packet_broker || {};
  const promptPacket = runtime.prompt || {};
  const promptWindow = runtime.prompt_window || {};
  const promptSections = promptWindow.prompt_sections || {};
  const history = sessionDoc?.rk_history || [];
  const recallItems = recallPacket?.items || [];
  const signalValues = Object.values(statePacket.signals || {}).filter((value) => Number(value) > 0);
  const promptSize = Number(promptPacket.prompt_chars || promptPacket.characters || promptPacket.length || 0);
  const promptScore = promptSize ? Math.max(10, 100 - Math.min(90, Math.round(promptSize / 80))) : 70;
  const systemValues = {
    turn_count: runtimeLast?.turn_count ?? 0,
    state: statePacket.state,
    mode: statePacket.mode,
    zone: statePacket.zone,
    persona: personaPacket?.persona_id || promptWindow.persona || 'BRUNEL',
    broker_volume: brokerPacket.volume ?? engineConfig?.packet_broker?.volume ?? 0,
    prompt_history_turns: runtimeFlags.prompt_history_turns,
    runtime_keys: runtimeLast?.runtime_keys || [],
    local_memory_writable: Boolean(memoryStatus?.writable),
    persona_packet_live_path: Boolean(personaPacket?.persona_packet_live_path ?? runtimeFlags.persona_packet_live_path),
    recall_live_path: Boolean(memoryPacket.chronological_recall_live_path ?? runtimeFlags.chronological_recall_live_path),
    recall_items: recallItems.length,
  };
  const activeSeed = { persona: promptWindow.persona || 'BRUNEL', user_message: promptWindow.user_message || null, state: statePacket.state || null, mode: statePacket.mode || null, zone: statePacket.zone || null, directive: statePacket.directive || null, previous_state: statePacket.previous_state || null, previous_mode: statePacket.previous_mode || null, flags: statePacket.flags || [], signals: statePacket.signals || {}, tribunal: statePacket.tribunal || {}, pressure: runtime.pressure || {} };
  const runtimeControls = { packet_volume: packetVolume, forced_state: pickState || null, forced_mode: pickMode || null };
  const fullSnapshot = { captured_at: new Date().toISOString(), engine_config: engineConfig, memory_status: memoryStatus, runtime_last: runtimeLast, session: sessionDoc, runtime };
  const egressStack = [['runtime', Boolean(runtimeLast?.ok)], ['persona', Boolean(personaPacket?.engaged || personaPacket?.identity)], ['state', Boolean(runtime.state)], ['broker', Boolean(runtime.packet_broker)], ['memory', Boolean(runtime.memory)], ['recall', Boolean(recallPacket?.metadata || recallItems.length)], ['local disk', Boolean(memoryStatus?.writable)], ['prompt window', Boolean(runtime.prompt_window)], ['history', Boolean(history.length)]];
  const influence = [['State', 24 + signalValues.length * 2], ['Memory', recallItems.length ? 28 : 8], ['Persona', personaPacket?.engaged ? 20 : 4], ['Pressure', pressure?.momentum === 'high' ? 14 : 9], ['Broker', Number(brokerPacket.volume || 0) ? 10 : 3], ['Delivery', 6]];
  const influenceTotal = influence.reduce((sum, [, value]) => sum + value, 0) || 1;
  const influenceRows = influence.map(([label, value]) => [label, Math.round((value / influenceTotal) * 100)]);

  const setFlag = (key, value) => setRuntimeFlags((prev) => ({ ...normalizeFlags(prev), [key]: value }));
  const copyCard = async (title, value) => { await navigator.clipboard.writeText(safeJson(value)); setMsg(`${title.toLowerCase()} copied`); };
  const toggleCard = (key) => setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));
  const setAllCards = (open) => setOpenCards(Object.fromEntries(Object.keys(INSPECTION_CARD_DEFAULTS).map((key) => [key, open])));

  const load = useCallback(async () => {
    if (!session?.access_token || !user?.id) return;
    setLoading(true);
    setMsg('');
    try {
      const [adminRuntime, lastRuntime, sessionState, memoryState] = await Promise.all([
        axios.get(`${API}/admin/runtime`, { headers: authHeader }),
        axios.get(`${API}/runtime/last`, { headers: authHeader }),
        axios.get(`${API}/session/${user.id}`, { headers: authHeader }),
        axios.get(`${API}/memory/status`, { headers: authHeader }),
      ]);
      setEngineConfig(adminRuntime.data || {});
      setRuntimeLast(lastRuntime.data || {});
      setSessionDoc(sessionState.data || {});
      setMemoryStatus(memoryState.data || {});
      setPacketVolume(Number(adminRuntime.data?.packet_broker?.volume ?? 0));
      setPickState(adminRuntime.data?.admin_override?.state || '');
      setPickMode(adminRuntime.data?.admin_override?.mode || '');
      setRuntimeFlags(normalizeFlags(adminRuntime.data?.runtime_flags));
      setForbidden(false);
    } catch (e) {
      if (e?.response?.status === 403) setForbidden(true);
      else setMsg(e?.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  }, [authHeader, session?.access_token, user?.id]);

  useEffect(() => { load(); }, [load]);

  const applyRuntime = async () => {
    setBusy(true);
    setMsg('');
    try {
      await axios.post(`${API}/admin/runtime`, { state: pickState || null, mode: pickMode || null, runtime_flags: runtimeFlags }, { headers: authHeader });
      await axios.post(`${API}/admin/packet-broker`, { volume: Number(packetVolume) }, { headers: authHeader });
      setMsg('runtime controls applied');
      await load();
    } catch (e) { setMsg(e?.response?.data?.detail || e.message); } finally { setBusy(false); }
  };
  const clearOverrides = async () => {
    setBusy(true);
    setMsg('');
    try {
      await axios.post(`${API}/admin/runtime`, { state: '', mode: '', runtime_flags: runtimeFlags }, { headers: authHeader });
      setPickState('');
      setPickMode('');
      setMsg('state/mode overrides cleared');
      await load();
    } catch (e) { setMsg(e?.response?.data?.detail || e.message); } finally { setBusy(false); }
  };
  const copySnapshot = async () => { await navigator.clipboard.writeText(safeJson(fullSnapshot)); setMsg('snapshot copied'); };

  if (loading) return <div className="engine-admin">…</div>;
  if (forbidden) return <div className="engine-admin"><div className="engine-card engine-card-wide" data-tone="warning"><div className="engine-card-body">403 · admin only</div></div></div>;

  const ControlsView = () => <><div className="engine-section-label">Controls</div><section className="engine-controls-grid"><Card title="Runtime Controls" subtitle="Admin override board." copyValue={runtimeControls} onCopy={copyCard} collapsible={false} tone="control"><div className="engine-control-row"><label><span>Packet Broker Volume</span><input type="range" min="0" max="100" value={packetVolume} onChange={(e) => setPacketVolume(e.target.value)} /><strong>{packetVolume}</strong></label></div><div className="engine-two-col"><label className="engine-field"><span>Forced State</span><input value={pickState} onChange={(e) => setPickState(e.target.value)} placeholder="natural" /></label><label className="engine-field"><span>Forced Mode</span><input value={pickMode} onChange={(e) => setPickMode(e.target.value)} placeholder="natural" /></label></div><div className="engine-button-row"><button className="engine-btn engine-btn-primary" onClick={applyRuntime} disabled={busy}>{busy ? 'Applying...' : 'Apply Controls'}</button><button className="engine-btn" onClick={clearOverrides} disabled={busy}>Clear State / Mode</button></div></Card><Card title="Runtime Flags" subtitle="Prompt influence switches." copyValue={runtimeFlags} onCopy={copyCard} collapsible={false} tone="control"><div className="engine-control-row"><label><span>Prompt History Turns</span><input type="range" min="0" max="80" value={runtimeFlags.prompt_history_turns ?? 0} onChange={(e) => setFlag('prompt_history_turns', Number(e.target.value))} /><strong>{runtimeFlags.prompt_history_turns ?? 0}</strong></label></div><div className="engine-toggle-grid">{FLAG_LABELS.map(([key, label]) => <button key={key} type="button" className="engine-toggle" data-active={runtimeFlags[key] ? 'true' : 'false'} onClick={() => setFlag(key, !runtimeFlags[key])}>{runtimeFlags[key] ? 'ON' : 'OFF'} · {label}</button>)}</div></Card></section></>;

  return <div className="engine-admin" data-testid="admin-page"><style>{CSS}</style><header className="engine-admin-topbar"><div><div className="engine-brand-name">BRUNEL</div><div className="engine-brand-sub">admin · engine console</div></div><div className="engine-admin-actions"><button className="engine-btn" onClick={load} disabled={busy}>Refresh</button><button className="engine-btn" onClick={copySnapshot}>Copy Snapshot</button><button className="engine-btn" onClick={() => setAllCards(true)}>Expand All</button><button className="engine-btn" onClick={() => setAllCards(false)}>Collapse All</button><button className="engine-btn" onClick={() => navigate('/brunel')}>Back to BRUNEL</button><button className="engine-btn engine-btn-dim" onClick={() => window.confirm('Sign out of BRUNEL?') && signOut()}>Sign out</button></div></header>{msg && <div className="engine-message">{msg}</div>}<div className="engine-tabs"><button className="engine-tab" data-active={viewMode === 'overview' ? 'true' : 'false'} onClick={() => setViewMode('overview')}>Overview</button><button className="engine-tab" data-active={viewMode === 'controls' ? 'true' : 'false'} onClick={() => setViewMode('controls')}>Controls</button><button className="engine-tab" data-active={viewMode === 'inspector' ? 'true' : 'false'} onClick={() => setViewMode('inspector')}>Inspector</button><button className="engine-tab" data-active={viewMode === 'trace' ? 'true' : 'false'} onClick={() => setViewMode('trace')}>Trace</button></div>
    {viewMode === 'overview' && <><div className="engine-section-label">Overview</div><main className="engine-overview-grid"><section className="engine-hero"><div className="engine-hero-title">BRUNEL</div><div className="engine-hero-grid"><Stat label="State" value={statePacket.state || '—'} /><Stat label="Mode" value={statePacket.mode || '—'} /><Stat label="Pressure" value={pressure.momentum || pressure.state_bias || '—'} /><Stat label="Turn" value={runtimeLast?.turn_count ?? '—'} /><Stat label="Memory" value={memoryStatus?.writable ? 'Writable' : 'Check'} /><Stat label="Recall" value={recallItems.length ? `${recallItems.length} items` : 'Quiet'} /></div></section><Card title="Subsystem Status" subtitle="Fast health strip for active runtime systems." wide tone="runtime" collapsible={false}><div className="engine-health-strip"><HealthItem label="Memory" value={memoryStatus?.writable ? 'LIVE' : 'CHECK'} score={memoryStatus?.writable ? 100 : 35} /><HealthItem label="Recall" value={systemValues.recall_live_path ? 'LIVE' : 'OFF'} score={systemValues.recall_live_path ? 92 : 20} /><HealthItem label="Persona" value={systemValues.persona_packet_live_path ? 'LIVE' : 'OFF'} score={systemValues.persona_packet_live_path ? 96 : 20} /><HealthItem label="Pressure" value={pressure.momentum || 'stable'} score={pressure.momentum === 'high' ? 74 : 56} /><HealthItem label="Signals" value={signalValues.length} score={Math.min(100, signalValues.length * 16)} /><HealthItem label="Prompt" value={promptSize ? `${promptSize}` : 'ok'} score={promptScore} /></div></Card><Card title="Decision Summary" subtitle="Human-readable view of the active runtime." tone="runtime" collapsible={false}><ReadRow label="State" value={statePacket.state} /><ReadRow label="Mode" value={statePacket.mode} /><ReadRow label="Zone" value={statePacket.zone} /><ReadRow label="Reason" value={statePacket.core_decision?.reason} /><ReadRow label="Persona" value={personaPacket.identity?.role || personaPacket.persona_id} /><ReadRow label="Recall" value={recallPacket.reason || 'No recall packet'} /></Card><Card title="Influence View" subtitle="Estimated influence from active runtime packets." tone="runtime" collapsible={false}>{influenceRows.map(([label, value]) => <InfluenceRow key={label} label={label} value={value} />)}</Card><Card title="Memory Recall" subtitle="Selected memory cues for the current prompt." tone="memory" collapsible={false}><ReadRow label="Triggered" value={recallPacket.triggered ? 'yes' : 'no'} /><ReadRow label="Reason" value={recallPacket.reason} /><ReadRow label="Items" value={recallItems.length} />{recallItems.slice(0, 3).map((item, idx) => <ReadRow key={item.turnId || idx} label={`Memory ${idx + 1}`} value={item.summary} />)}</Card><Card title="Packet Flow" subtitle="Current packet path status." tone="runtime" collapsible={false}>{egressStack.map(([label, active]) => <span key={label} className="egress-chip" data-active={active ? 'true' : 'false'}>{active ? '✓' : '○'} {label}</span>)}</Card></main></>}
    {viewMode === 'controls' && <ControlsView />}
    {viewMode === 'trace' && <><div className="engine-section-label">Trace</div><main className="engine-trace-grid"><TraceStep title="User Message" text={(promptWindow.user_message || '').slice(0, 260) || 'No captured user message.'} active={Boolean(promptWindow.user_message)} /><TraceStep title="Packet Broker" text={`${brokerPacket.packet_count ?? 0} packets. Volume ${brokerPacket.volume ?? 0}. ${(brokerPacket.notes || []).slice(0, 2).join(' ')}`} active={Boolean(runtime.packet_broker)} /><TraceStep title="Signal Analysis" text={Object.entries(statePacket.signals || {}).map(([key, value]) => `${key}: ${value}`).join(' · ') || 'No signal packet.'} active={Boolean(statePacket.signals)} /><TraceStep title="Tribunal" text={`Sentinel ${statePacket.tribunal?.sentinel ?? 0} · Arbiter ${statePacket.tribunal?.arbiter ?? 0} · Empath ${statePacket.tribunal?.empath ?? 0}`} active={Boolean(statePacket.tribunal)} /><TraceStep title="Pressure" text={`Momentum ${pressure.momentum || 'unknown'} · bias ${pressure.state_bias || 'unknown'} · trust ${pressure.trust ?? '—'} · elapsed ${pressure.elapsed_since_previous || pressurePacket.elapsed_silence || '—'}`} active={Boolean(runtime.pressure)} /><TraceStep title="Core Decision" text={`${statePacket.core_decision?.candidate_state || statePacket.candidate_state || 'candidate unknown'} → ${statePacket.core_decision?.final_state || statePacket.state || 'state unknown'} · ${statePacket.core_decision?.reason || 'no reason captured'}`} active={Boolean(statePacket.core_decision)} /><TraceStep title="Persona Packet" text={`${personaPacket.persona_id || 'BRUNEL'} · ${personaPacket.metadata?.directive_status || 'packet captured'} · prompt included: ${personaPacket.persona_packet_prompt_included ? 'yes' : 'no'}`} active={Boolean(personaPacket.engaged)} /><TraceStep title="Memory Recall" text={`${recallItems.length} selected · ${recallPacket.reason || 'no recall reason'} · summary first: ${recallPacket.limits?.summary_first ? 'yes' : 'no'}`} active={Boolean(recallPacket.metadata)} /><TraceStep title="Prompt Assembly" text={`${Object.keys(promptSections || {}).length} sections captured. Persona packet ${personaPacket.persona_packet_prompt_included ? 'included' : 'quiet'}. Recall ${memoryPacket.chronological_recall_prompt_included ? 'included' : 'quiet'}.`} active={Boolean(runtime.prompt_window)} /><TraceStep title="Response + Memory Write" text={`Turn ${runtimeLast?.turn_count ?? '—'}. Chronological write ${runtime.chronological_memory?.ok ? 'ok' : 'check runtime packet'}.`} active={Boolean(runtimeLast?.ok)} /></main></>}
    {viewMode === 'inspector' && <><div className="engine-section-label">Inspection cards</div><main className="engine-grid"><Card title="System Values" subtitle="Fast read of the live engine state." wide copyValue={systemValues} onCopy={copyCard} open={openCards.system} onToggle={() => toggleCard('system')} tone="runtime"><div className="value-grid"><Chip label="turns" value={systemValues.turn_count} /><Chip label="persona" value={systemValues.persona} /><Chip label="state" value={systemValues.state} /><Chip label="mode" value={systemValues.mode} /><Chip label="zone" value={systemValues.zone} /><Chip label="broker" value={systemValues.broker_volume} /><Chip label="history cap" value={systemValues.prompt_history_turns} /><Chip label="runtime keys" value={systemValues.runtime_keys.length} /><Chip label="local memory" value={systemValues.local_memory_writable ? 'writable' : 'check'} /><Chip label="persona packet" value={systemValues.persona_packet_live_path ? 'live' : 'quiet'} /><Chip label="recall" value={systemValues.recall_live_path ? 'live' : 'quiet'} /><Chip label="recall items" value={systemValues.recall_items} /></div><div className="egress-stack">{egressStack.map(([label, active]) => <span key={label} className="egress-chip" data-active={active ? 'true' : 'false'}>{label}</span>)}</div></Card><Card title="Chronological Recall" subtitle="Selective native memory recall packet from the local chronological body." copyValue={recallPacket} onCopy={copyCard} open={openCards.recall} onToggle={() => toggleCard('recall')} tone="memory"><div className="value-grid"><Chip label="triggered" value={recallPacket?.triggered ? 'yes' : 'no'} /><Chip label="items" value={recallItems.length} /><Chip label="source" value={recallPacket?.metadata?.source || '—'} /><Chip label="stuffing" value={recallPacket?.metadata?.context_stuffing === false ? 'no' : 'check'} /></div><JsonPanel value={recallPacket} maxHeight={320} /></Card><Card title="Persona Packet" subtitle="Explicit BRUNEL identity, active profile, and silent behavior rules." wide copyValue={personaPacket} onCopy={copyCard} open={openCards.persona} onToggle={() => toggleCard('persona')} tone="runtime"><div className="value-grid"><Chip label="engaged" value={personaPacket?.engaged ? 'yes' : 'no'} /><Chip label="persona" value={personaPacket?.persona_id || 'BRUNEL'} /><Chip label="state" value={personaPacket?.active_profile?.state || '—'} /><Chip label="mode" value={personaPacket?.active_profile?.mode || '—'} /><Chip label="prompt" value={personaPacket?.persona_packet_prompt_included ? 'included' : 'quiet'} /></div><JsonPanel value={personaPacket} maxHeight={360} /></Card><Card title="Local Memory Body" subtitle="Persistent Render disk status for BRUNEL chronological memory." wide copyValue={memoryStatus} onCopy={copyCard} open={openCards.memoryBody} onToggle={() => toggleCard('memoryBody')} tone="memory"><div className="value-grid"><Chip label="ok" value={memoryStatus?.ok ? 'yes' : 'no'} /><Chip label="env" value={memoryStatus?.env_present ? 'set' : 'missing'} /><Chip label="exists" value={memoryStatus?.exists ? 'yes' : 'no'} /><Chip label="writable" value={memoryStatus?.writable ? 'yes' : 'no'} /><Chip label="memory dir" value={memoryStatus?.memory_dir || '—'} /><Chip label="free" value={bytes(memoryStatus?.disk?.free_bytes)} /><Chip label="used" value={bytes(memoryStatus?.disk?.used_bytes)} /><Chip label="recent files" value={(memoryStatus?.recent_files || []).length} /></div><JsonPanel value={memoryStatus} maxHeight={280} /></Card><Card title="Active Seed" subtitle="Current response seed summary." wide copyValue={activeSeed} onCopy={copyCard} open={openCards.activeSeed} onToggle={() => toggleCard('activeSeed')} tone="runtime"><JsonPanel value={activeSeed} maxHeight={260} /></Card><Card title="Memory / Context" subtitle="Working memory and prompt memory packet." copyValue={memoryPacket} onCopy={copyCard} open={openCards.memory} onToggle={() => toggleCard('memory')} tone="memory"><JsonPanel value={memoryPacket} maxHeight={320} /></Card><Card title="Packet Broker" subtitle="Last packet broker packet." copyValue={brokerPacket} onCopy={copyCard} open={openCards.broker} onToggle={() => toggleCard('broker')} tone="runtime"><JsonPanel value={brokerPacket} maxHeight={260} /></Card><Card title="Prompt Builder" subtitle="Prompt packet metadata." copyValue={promptPacket} onCopy={copyCard} open={openCards.promptBuilder} onToggle={() => toggleCard('promptBuilder')} tone="runtime"><JsonPanel value={promptPacket} maxHeight={260} /></Card><Card title="Prompt Window" subtitle="Captured system prompt leaving Core." wide copyValue={promptWindow} onCopy={copyCard} open={openCards.promptWindow} onToggle={() => toggleCard('promptWindow')} tone="runtime"><JsonPanel value={promptWindow} maxHeight={420} /></Card><Card title="Prompt Sections" subtitle="PROMPT WINDOW sections extracted for inspection." wide copyValue={promptSections} onCopy={copyCard} open={openCards.promptSections} onToggle={() => toggleCard('promptSections')} tone="runtime"><JsonPanel value={promptSections} maxHeight={420} /></Card><Card title="Session" subtitle="Current saved BRUNEL session document." wide copyValue={sessionDoc} onCopy={copyCard} open={openCards.session} onToggle={() => toggleCard('session')} tone="runtime"><JsonPanel value={sessionDoc} maxHeight={420} /></Card><Card title="Full Runtime Packet" subtitle="Everything captured from the engine for the last turn." wide copyValue={runtime} onCopy={copyCard} open={openCards.runtime} onToggle={() => toggleCard('runtime')} tone="runtime"><JsonPanel value={runtime} maxHeight={520} /></Card></main></>}
  </div>;
}
