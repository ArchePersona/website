import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext.jsx';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://brunel-5lxo.onrender.com';
const API = `${BACKEND_URL}/api`;

const DEFAULT_RUNTIME_FLAGS = {
  memory_live_path: false,
  prompt_history_turns: 0,
  temporal_prompt_path: false,
  reflection_prompt_path: false,
  context_prompt_path: false,
  transcript_prompt_path: false,
  mediator_prompt_path: true,
};

const FLAG_LABELS = [
  ['memory_live_path', 'Memory live path'],
  ['temporal_prompt_path', 'Temporal prompt'],
  ['reflection_prompt_path', 'Reflection prompt'],
  ['context_prompt_path', 'Context prompt'],
  ['transcript_prompt_path', 'Transcript prompt'],
  ['mediator_prompt_path', 'Mediator posture'],
];

const CSS = `
.engine-admin { min-height: 100dvh; overflow-y: auto; padding: 14px; background: #05080b; color: #e8fff0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.engine-admin-topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid rgba(80,255,150,0.22); padding-bottom: 12px; margin-bottom: 12px; }
.engine-brand-name { color: #d7b35a; font-size: 20px; letter-spacing: 0.22em; }
.engine-brand-sub { color: #7dffae; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; margin-top: 4px; }
.engine-admin-actions, .engine-button-row, .engine-card-actions, .value-grid, .egress-stack { display: flex; flex-wrap: wrap; gap: 7px; }
.engine-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 12px; }
.engine-card { grid-column: span 6; border: 1px solid rgba(80,255,150,0.18); background: rgba(8,14,20,0.92); min-width: 0; }
.engine-card-wide { grid-column: span 12; }
.engine-card-head { display: flex; justify-content: space-between; gap: 8px; padding: 10px 12px; border-bottom: 1px solid rgba(80,255,150,0.12); background: rgba(80,255,150,0.035); }
.engine-card-title { color: #7dffae; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; }
.engine-card-subtitle { color: rgba(232,255,240,0.58); font-size: 9px; margin-top: 3px; }
.engine-card-body { padding: 12px; }
.engine-btn, .engine-mini-btn { background: transparent; border: 1px solid rgba(80,255,150,0.24); color: #7dffae; font: inherit; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; padding: 8px 10px; cursor: pointer; }
.engine-mini-btn { padding: 5px 8px; font-size: 8px; }
.engine-btn-primary { border-color: #d7b35a; color: #d7b35a; }
.engine-btn-dim { color: rgba(232,255,240,0.56); border-color: rgba(232,255,240,0.16); }
.engine-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.engine-message { border: 1px solid rgba(215,179,90,0.5); color: #d7b35a; background: rgba(215,179,90,0.08); padding: 8px 10px; margin-bottom: 12px; font-size: 10px; }
.value-chip, .egress-chip { display: inline-flex; border: 1px solid rgba(232,255,240,0.14); color: rgba(232,255,240,0.72); background: rgba(255,255,255,0.025); padding: 4px 8px; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
.value-chip strong { color: #7dffae; margin-left: 6px; }
.egress-chip[data-active='true'] { color: #7dffae; border-color: rgba(80,255,150,0.3); background: rgba(80,255,150,0.06); }
.engine-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.engine-field, .engine-control-row label { display: flex; flex-direction: column; gap: 7px; color: rgba(232,255,240,0.68); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; }
.engine-field input { background: rgba(0,0,0,0.32); border: 1px solid rgba(232,255,240,0.16); color: #fff; padding: 9px 10px; font: inherit; }
.engine-control-row input[type='range'] { width: 100%; accent-color: #7dffae; }
.engine-control-row strong { color: #7dffae; font-size: 22px; }
.engine-toggle-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.engine-toggle { text-align: left; background: rgba(255,255,255,0.02); border: 1px solid rgba(232,255,240,0.14); color: rgba(232,255,240,0.68); font: inherit; padding: 9px; cursor: pointer; }
.engine-toggle[data-active='true'] { color: #7dffae; border-color: rgba(80,255,150,0.5); background: rgba(80,255,150,0.08); }
.engine-json { white-space: pre-wrap; word-break: break-word; overflow: auto; background: rgba(0,0,0,0.42); color: #e8fff0; border: 1px solid rgba(232,255,240,0.12); padding: 12px; font-size: 11px; line-height: 1.55; }
@media (max-width: 900px) { .engine-admin { padding: 10px; } .engine-admin-topbar { flex-direction: column; } .engine-card, .engine-card-wide { grid-column: span 12; } .engine-two-col, .engine-toggle-grid { grid-template-columns: 1fr; } }
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
function Card({ title, subtitle, children, wide = false, copyValue, onCopy }) {
  const actions = copyValue === undefined ? null : <div className="engine-card-actions"><button className="engine-mini-btn" onClick={() => onCopy(title, copyValue)}>Copy</button></div>;
  return <section className={`engine-card${wide ? ' engine-card-wide' : ''}`}><div className="engine-card-head"><div><div className="engine-card-title">{title}</div>{subtitle && <div className="engine-card-subtitle">{subtitle}</div>}</div>{actions}</div><div className="engine-card-body">{children}</div></section>;
}
function Chip({ label, value }) { return <span className="value-chip">{label}<strong>{String(value ?? '—')}</strong></span>; }
function JsonPanel({ value, maxHeight = 340 }) { return <pre className="engine-json" style={{ maxHeight }}>{safeJson(value)}</pre>; }

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

  const runtime = runtimeLast?.runtime || {};
  const statePacket = runtime.state || {};
  const memoryPacket = runtime.memory || {};
  const recallPacket = memoryPacket.chronological_recall || sessionDoc?.last_chronological_recall || {};
  const brokerPacket = runtime.packet_broker || {};
  const promptPacket = runtime.prompt || {};
  const promptWindow = runtime.prompt_window || {};
  const promptSections = promptWindow.prompt_sections || {};
  const history = sessionDoc?.rk_history || [];
  const systemValues = {
    turn_count: runtimeLast?.turn_count ?? 0,
    state: statePacket.state,
    mode: statePacket.mode,
    zone: statePacket.zone,
    broker_volume: brokerPacket.volume ?? engineConfig?.packet_broker?.volume ?? 0,
    prompt_history_turns: runtimeFlags.prompt_history_turns,
    runtime_keys: runtimeLast?.runtime_keys || [],
    local_memory_writable: Boolean(memoryStatus?.writable),
    recall_live_path: Boolean(memoryPacket.chronological_recall_live_path),
    recall_items: (recallPacket?.items || []).length,
  };
  const activeSeed = {
    persona: promptWindow.persona || 'BRUNEL',
    user_message: promptWindow.user_message || null,
    state: statePacket.state || null,
    mode: statePacket.mode || null,
    zone: statePacket.zone || null,
    directive: statePacket.directive || null,
    previous_state: statePacket.previous_state || null,
    previous_mode: statePacket.previous_mode || null,
    flags: statePacket.flags || [],
    signals: statePacket.signals || {},
    tribunal: statePacket.tribunal || {},
    pressure: runtime.pressure || {},
  };
  const runtimeControls = { packet_volume: packetVolume, forced_state: pickState || null, forced_mode: pickMode || null };
  const fullSnapshot = { captured_at: new Date().toISOString(), engine_config: engineConfig, memory_status: memoryStatus, runtime_last: runtimeLast, session: sessionDoc, runtime };
  const egressStack = [
    ['runtime', Boolean(runtimeLast?.ok)], ['state', Boolean(runtime.state)], ['broker', Boolean(runtime.packet_broker)], ['memory', Boolean(runtime.memory)], ['recall', Boolean(recallPacket?.metadata || (recallPacket?.items || []).length)], ['local disk', Boolean(memoryStatus?.writable)], ['prompt window', Boolean(runtime.prompt_window)], ['history', Boolean(history.length)],
  ];

  const setFlag = (key, value) => setRuntimeFlags((prev) => ({ ...normalizeFlags(prev), [key]: value }));
  const copyCard = async (title, value) => { await navigator.clipboard.writeText(safeJson(value)); setMsg(`${title.toLowerCase()} copied`); };

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
  if (forbidden) return <div className="engine-admin"><div className="engine-card engine-card-wide"><div className="engine-card-body">403 · admin only</div></div></div>;

  return (
    <div className="engine-admin" data-testid="admin-page">
      <style>{CSS}</style>
      <header className="engine-admin-topbar">
        <div><div className="engine-brand-name">BRUNEL</div><div className="engine-brand-sub">admin · engine console</div></div>
        <div className="engine-admin-actions"><button className="engine-btn" onClick={load} disabled={busy}>Refresh</button><button className="engine-btn" onClick={copySnapshot}>Copy Snapshot</button><button className="engine-btn" onClick={() => navigate('/brunel')}>Back to BRUNEL</button><button className="engine-btn engine-btn-dim" onClick={() => window.confirm('Sign out of BRUNEL?') && signOut()}>Sign out</button></div>
      </header>
      {msg && <div className="engine-message">{msg}</div>}
      <main className="engine-grid">
        <Card title="System Values" subtitle="Fast read of the live engine state." wide copyValue={systemValues} onCopy={copyCard}>
          <div className="value-grid"><Chip label="turns" value={systemValues.turn_count} /><Chip label="state" value={systemValues.state} /><Chip label="mode" value={systemValues.mode} /><Chip label="zone" value={systemValues.zone} /><Chip label="broker" value={systemValues.broker_volume} /><Chip label="history cap" value={systemValues.prompt_history_turns} /><Chip label="runtime keys" value={systemValues.runtime_keys.length} /><Chip label="local memory" value={systemValues.local_memory_writable ? 'writable' : 'check'} /><Chip label="recall" value={systemValues.recall_live_path ? 'live' : 'quiet'} /><Chip label="recall items" value={systemValues.recall_items} /></div>
          <div className="egress-stack">{egressStack.map(([label, active]) => <span key={label} className="egress-chip" data-active={active ? 'true' : 'false'}>{label}</span>)}</div>
        </Card>
        <Card title="Local Memory Body" subtitle="Persistent Render disk status for BRUNEL chronological memory." wide copyValue={memoryStatus} onCopy={copyCard}>
          <div className="value-grid"><Chip label="ok" value={memoryStatus?.ok ? 'yes' : 'no'} /><Chip label="env" value={memoryStatus?.env_present ? 'set' : 'missing'} /><Chip label="exists" value={memoryStatus?.exists ? 'yes' : 'no'} /><Chip label="writable" value={memoryStatus?.writable ? 'yes' : 'no'} /><Chip label="memory dir" value={memoryStatus?.memory_dir || '—'} /><Chip label="free" value={bytes(memoryStatus?.disk?.free_bytes)} /><Chip label="used" value={bytes(memoryStatus?.disk?.used_bytes)} /><Chip label="recent files" value={(memoryStatus?.recent_files || []).length} /></div>
          <JsonPanel value={memoryStatus} maxHeight={280} />
        </Card>
        <Card title="Runtime Controls" subtitle="Admin override board." copyValue={runtimeControls} onCopy={copyCard}>
          <div className="engine-control-row"><label><span>Packet Broker Volume</span><input type="range" min="0" max="100" value={packetVolume} onChange={(e) => setPacketVolume(e.target.value)} /><strong>{packetVolume}</strong></label></div>
          <div className="engine-two-col"><label className="engine-field"><span>Forced State</span><input value={pickState} onChange={(e) => setPickState(e.target.value)} placeholder="natural" /></label><label className="engine-field"><span>Forced Mode</span><input value={pickMode} onChange={(e) => setPickMode(e.target.value)} placeholder="natural" /></label></div>
          <div className="engine-button-row"><button className="engine-btn engine-btn-primary" onClick={applyRuntime} disabled={busy}>{busy ? 'Applying...' : 'Apply Controls'}</button><button className="engine-btn" onClick={clearOverrides} disabled={busy}>Clear State / Mode</button></div>
        </Card>
        <Card title="Runtime Flags" subtitle="Prompt influence switches." copyValue={runtimeFlags} onCopy={copyCard}>
          <div className="engine-control-row"><label><span>Prompt History Turns</span><input type="range" min="0" max="80" value={runtimeFlags.prompt_history_turns ?? 0} onChange={(e) => setFlag('prompt_history_turns', Number(e.target.value))} /><strong>{runtimeFlags.prompt_history_turns ?? 0}</strong></label></div>
          <div className="engine-toggle-grid">{FLAG_LABELS.map(([key, label]) => <button key={key} type="button" className="engine-toggle" data-active={runtimeFlags[key] ? 'true' : 'false'} onClick={() => setFlag(key, !runtimeFlags[key])}>{runtimeFlags[key] ? 'ON' : 'OFF'} · {label}</button>)}</div>
        </Card>
        <Card title="Active Seed" subtitle="Current response seed summary." wide copyValue={activeSeed} onCopy={copyCard}><JsonPanel value={activeSeed} maxHeight={260} /></Card>
        <Card title="Memory / Context" subtitle="Working memory and prompt memory packet." copyValue={memoryPacket} onCopy={copyCard}><JsonPanel value={memoryPacket} maxHeight={320} /></Card>
        <Card title="Chronological Recall" subtitle="Selective native memory recall packet from the local chronological body." copyValue={recallPacket} onCopy={copyCard}>
          <div className="value-grid"><Chip label="triggered" value={recallPacket?.triggered ? 'yes' : 'no'} /><Chip label="items" value={(recallPacket?.items || []).length} /><Chip label="source" value={recallPacket?.metadata?.source || '—'} /><Chip label="stuffing" value={recallPacket?.metadata?.context_stuffing === false ? 'no' : 'check'} /></div>
          <JsonPanel value={recallPacket} maxHeight={320} />
        </Card>
        <Card title="Packet Broker" subtitle="Last packet broker packet." copyValue={brokerPacket} onCopy={copyCard}><JsonPanel value={brokerPacket} maxHeight={260} /></Card>
        <Card title="Prompt Builder" subtitle="Prompt packet metadata." copyValue={promptPacket} onCopy={copyCard}><JsonPanel value={promptPacket} maxHeight={260} /></Card>
        <Card title="Prompt Window" subtitle="Captured system prompt leaving Core." wide copyValue={promptWindow} onCopy={copyCard}><JsonPanel value={promptWindow} maxHeight={420} /></Card>
        <Card title="Prompt Sections" subtitle="PROMPT WINDOW sections extracted for inspection." wide copyValue={promptSections} onCopy={copyCard}><JsonPanel value={promptSections} maxHeight={420} /></Card>
        <Card title="Session" subtitle="Current saved BRUNEL session document." wide copyValue={sessionDoc} onCopy={copyCard}><JsonPanel value={sessionDoc} maxHeight={420} /></Card>
        <Card title="Full Runtime Packet" subtitle="Everything captured from the engine for the last turn." wide copyValue={runtime} onCopy={copyCard}><JsonPanel value={runtime} maxHeight={520} /></Card>
      </main>
    </div>
  );
}
