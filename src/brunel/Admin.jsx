import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "./AuthContext.jsx";
import "./App.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://brunel-5lxo.onrender.com";
const API = `${BACKEND_URL}/api`;
const RESPONSE_MAX_TOKENS = 2200;

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
  ["memory_live_path", "Memory live path", "Allows prompt memories and working memory back into model prompt."],
  ["temporal_prompt_path", "Temporal prompt", "Reserved switch for temporal packet prompt injection."],
  ["reflection_prompt_path", "Reflection prompt", "Reserved switch for reflection packet prompt injection."],
  ["context_prompt_path", "Context prompt", "Reserved switch for context packet prompt injection."],
  ["transcript_prompt_path", "Transcript prompt", "Reserved switch for transcript prompt injection."],
  ["mediator_prompt_path", "Mediator posture", "Allows mediator posture to shape the live prompt."],
];

const ENGINE_ADMIN_CSS = `
.engine-admin { min-height: 100dvh; overflow-y: auto; padding: 14px; background: #05080b; color: #e8fff0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.engine-admin-topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid rgba(80,255,150,0.22); padding-bottom: 12px; margin-bottom: 12px; }
.engine-brand-name { color: #d7b35a; font-size: 20px; letter-spacing: 0.22em; }
.engine-brand-sub { color: #7dffae; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; margin-top: 4px; }
.engine-admin-actions, .engine-button-row, .engine-card-actions, .seed-strip, .value-grid, .egress-stack { display: flex; flex-wrap: wrap; gap: 7px; }
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
.value-chip, .egress-chip, .seed-strip span, .tribunal-strip span { display: inline-flex; border: 1px solid rgba(232,255,240,0.14); color: rgba(232,255,240,0.72); background: rgba(255,255,255,0.025); padding: 4px 8px; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
.value-chip strong { color: #7dffae; margin-left: 6px; }
.egress-chip[data-active="true"] { color: #7dffae; border-color: rgba(80,255,150,0.3); background: rgba(80,255,150,0.06); }
.engine-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.engine-field, .engine-control-row label { display: flex; flex-direction: column; gap: 7px; color: rgba(232,255,240,0.68); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; }
.engine-field input { background: rgba(0,0,0,0.32); border: 1px solid rgba(232,255,240,0.16); color: #fff; padding: 9px 10px; font: inherit; }
.engine-control-row input[type="range"] { width: 100%; accent-color: #7dffae; }
.engine-control-row strong { color: #7dffae; font-size: 22px; }
.engine-toggle-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.engine-toggle { text-align: left; background: rgba(255,255,255,0.02); border: 1px solid rgba(232,255,240,0.14); color: rgba(232,255,240,0.68); font: inherit; padding: 9px; cursor: pointer; }
.engine-toggle[data-active="true"] { color: #7dffae; border-color: rgba(80,255,150,0.5); background: rgba(80,255,150,0.08); }
.engine-toggle-title { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; }
.engine-toggle-sub { margin-top: 5px; font-size: 8px; line-height: 1.35; color: rgba(232,255,240,0.54); }
.engine-json, .prompt-window-text { white-space: pre-wrap; word-break: break-word; overflow: auto; background: rgba(0,0,0,0.42); color: #e8fff0; border: 1px solid rgba(232,255,240,0.12); padding: 12px; font-size: 11px; line-height: 1.55; }
.prompt-window-text { max-height: 560px; border-color: rgba(80,255,150,0.22); }
.engine-meter-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
.engine-meter-top { display: flex; justify-content: space-between; color: rgba(232,255,240,0.68); font-size: 9px; text-transform: uppercase; margin-bottom: 5px; }
.engine-meter-track { height: 7px; background: rgba(255,255,255,0.05); border: 1px solid rgba(232,255,240,0.12); overflow: hidden; }
.engine-meter-fill { height: 100%; background: #7dffae; }
@media (max-width: 900px) { .engine-admin { padding: 10px; } .engine-admin-topbar { flex-direction: column; } .engine-card, .engine-card-wide { grid-column: span 12; } .engine-two-col, .engine-meter-grid, .engine-toggle-grid { grid-template-columns: 1fr; } }
`;

function normalizeFlags(flags) {
  return { ...DEFAULT_RUNTIME_FLAGS, ...(flags || {}) };
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch (_) {
    return "{}";
  }
}

function pct(value) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "0%";
  return `${Math.round(n * 100)}%`;
}

function buildReconstructedModelPayload({ systemPrompt, history, runtimeFlags }) {
  const turns = Array.isArray(history) ? history : [];
  const flags = normalizeFlags(runtimeFlags);
  const cap = Math.max(0, Math.min(80, Number(flags.prompt_history_turns ?? 0)));
  const lastTurn = turns.length ? turns[turns.length - 1] : null;
  const priorTurns = turns.length && cap ? turns.slice(Math.max(0, turns.length - 1 - cap), -1) : [];
  const messages = [];

  for (const turn of priorTurns) {
    if (turn?.user) messages.push({ role: "user", content: turn.user });
    if (turn?.assistant) messages.push({ role: "assistant", content: turn.assistant });
  }

  if (lastTurn?.user) messages.push({ role: "user", content: lastTurn.user });

  return {
    source: "AdminReconstructedModelPayload",
    reconstruction_note: "Rebuilt from saved RK history after the turn. Assistant reply from the latest turn is intentionally excluded to mirror pre-call egress.",
    max_tokens: RESPONSE_MAX_TOKENS,
    history_turn_cap: cap,
    system_prompt: systemPrompt || "",
    messages,
    message_count: messages.length,
    latest_user_message: lastTurn?.user || null,
  };
}

function EngineMeter({ label, value }) {
  const numeric = Math.max(0, Math.min(1, Number(value ?? 0)));
  return <div className="engine-meter"><div className="engine-meter-top"><span>{label}</span><span>{pct(numeric)}</span></div><div className="engine-meter-track"><div className="engine-meter-fill" style={{ width: `${numeric * 100}%` }} /></div></div>;
}

function DataBlock({ title, subtitle, children, actions, wide = false }) {
  return <section className={`engine-card${wide ? " engine-card-wide" : ""}`}><div className="engine-card-head"><div><div className="engine-card-title">{title}</div>{subtitle && <div className="engine-card-subtitle">{subtitle}</div>}</div>{actions && <div className="engine-card-actions">{actions}</div>}</div><div className="engine-card-body">{children}</div></section>;
}

function JsonPanel({ value, maxHeight = 340 }) {
  return <pre className="engine-json" style={{ maxHeight }}>{safeJson(value)}</pre>;
}

function TextPanel({ value, placeholder = "No prompt captured yet." }) {
  return <pre className="prompt-window-text">{value || placeholder}</pre>;
}

function ValueChip({ label, value }) {
  return <span className="value-chip">{label}<strong>{String(value ?? "—")}</strong></span>;
}

export default function Admin() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  const authHeader = useMemo(() => (session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}), [session?.access_token]);

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [engineConfig, setEngineConfig] = useState(null);
  const [runtimeLast, setRuntimeLast] = useState(null);
  const [sessionDoc, setSessionDoc] = useState(null);
  const [packetVolume, setPacketVolume] = useState(0);
  const [pickState, setPickState] = useState("");
  const [pickMode, setPickMode] = useState("");
  const [runtimeFlags, setRuntimeFlags] = useState(DEFAULT_RUNTIME_FLAGS);

  const runtime = runtimeLast?.runtime || {};
  const statePacket = runtime.state || {};
  const memoryPacket = runtime.memory || {};
  const brokerPacket = runtime.packet_broker || {};
  const promptPacket = runtime.prompt || {};
  const promptWindow = runtime.prompt_window || {};
  const promptSections = promptWindow.prompt_sections || {};
  const signals = statePacket.signals || {};
  const tribunal = statePacket.tribunal || {};
  const history = sessionDoc?.rk_history || [];

  const reconstructedModelPayload = buildReconstructedModelPayload({ systemPrompt: promptWindow.system_prompt, history, runtimeFlags });
  const seed = {
    user_message: promptWindow.user_message || reconstructedModelPayload.latest_user_message || null,
    persona: promptWindow.persona || "BRUNEL",
    state: statePacket.state || null,
    mode: statePacket.mode || null,
    zone: statePacket.zone || null,
    directive: statePacket.directive || null,
    previous_state: statePacket.previous_state || null,
    previous_mode: statePacket.previous_mode || null,
    flags: statePacket.flags || [],
    signals,
    tribunal,
    packet_broker: brokerPacket,
    pressure: runtime.pressure || {},
    working_memory: memoryPacket.working_memory || "",
    prompt_memory_context: memoryPacket.prompt_memory_context || [],
    memory_presearch: memoryPacket.memory_presearch || {},
    context: runtime.context || {},
    reflection: runtime.reflection || {},
    delivery_policy: runtime.delivery_policy || null,
    prompt_builder: promptPacket,
    prompt_window: promptWindow.metadata || {},
    reconstructed_model_payload: {
      message_count: reconstructedModelPayload.message_count,
      max_tokens: reconstructedModelPayload.max_tokens,
      history_turn_cap: reconstructedModelPayload.history_turn_cap,
      latest_user_message: reconstructedModelPayload.latest_user_message,
    },
  };
  const fullSnapshot = { captured_at: new Date().toISOString(), engine_config: engineConfig, runtime_last: runtimeLast, session: sessionDoc, reconstructed_model_payload: reconstructedModelPayload, runtime };
  const egressStack = [
    ["runtime", Boolean(runtimeLast?.ok)], ["state", Boolean(runtime.state)], ["broker", Boolean(runtime.packet_broker)], ["memory", Boolean(runtime.memory)],
    ["context", Boolean(runtime.context)], ["reflection", Boolean(runtime.reflection)], ["prompt", Boolean(runtime.prompt)], ["prompt window", Boolean(runtime.prompt_window)],
    ["history", Boolean(history.length)], ["model payload", Boolean(reconstructedModelPayload.message_count)],
  ];

  const setFlag = (key, value) => setRuntimeFlags((prev) => ({ ...normalizeFlags(prev), [key]: value }));

  const load = useCallback(async () => {
    if (!session?.access_token || !user?.id) return;
    setLoading(true);
    setMsg("");
    try {
      const [adminRuntime, lastRuntime, sessionState] = await Promise.all([
        axios.get(`${API}/admin/runtime`, { headers: authHeader }),
        axios.get(`${API}/runtime/last`, { headers: authHeader }),
        axios.get(`${API}/session/${user.id}`, { headers: authHeader }),
      ]);
      setEngineConfig(adminRuntime.data || {});
      setRuntimeLast(lastRuntime.data || {});
      setSessionDoc(sessionState.data || {});
      setPacketVolume(Number(adminRuntime.data?.packet_broker?.volume ?? 0));
      setPickState(adminRuntime.data?.admin_override?.state || "");
      setPickMode(adminRuntime.data?.admin_override?.mode || "");
      setRuntimeFlags(normalizeFlags(adminRuntime.data?.runtime_flags));
      setForbidden(false);
    } catch (e) {
      if (e?.response?.status === 403) setForbidden(true);
      else setMsg(e?.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }, [authHeader, session?.access_token, user?.id]);

  useEffect(() => { load(); }, [load]);

  const applyRuntime = async () => {
    setBusy(true);
    setMsg("");
    try {
      await axios.post(`${API}/admin/runtime`, { state: pickState || null, mode: pickMode || null, runtime_flags: runtimeFlags }, { headers: authHeader });
      await axios.post(`${API}/admin/packet-broker`, { volume: Number(packetVolume) }, { headers: authHeader });
      setMsg("runtime controls applied");
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  const clearOverrides = async () => {
    setBusy(true);
    setMsg("");
    try {
      await axios.post(`${API}/admin/runtime`, { state: "", mode: "", runtime_flags: runtimeFlags }, { headers: authHeader });
      setPickState("");
      setPickMode("");
      setMsg("state/mode overrides cleared");
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  const resetFlags = () => setRuntimeFlags(DEFAULT_RUNTIME_FLAGS);
  const copyPrompt = async () => { await navigator.clipboard.writeText(promptWindow.system_prompt || ""); setMsg("prompt copied"); };
  const copyPayload = async () => { await navigator.clipboard.writeText(safeJson(reconstructedModelPayload)); setMsg("model payload copied"); };
  const copySeed = async () => { await navigator.clipboard.writeText(safeJson(seed)); setMsg("seed copied"); };
  const copySnapshot = async () => { await navigator.clipboard.writeText(safeJson(fullSnapshot)); setMsg("full snapshot copied"); };
  const downloadSnapshot = () => {
    const blob = new Blob([safeJson(fullSnapshot)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brunel-engine-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("snapshot exported");
  };

  if (loading) return <div className="engine-admin">…</div>;
  if (forbidden) return <div className="engine-admin"><div className="engine-card engine-card-wide"><div className="engine-card-body">403 · admin only</div></div></div>;

  return (
    <div className="engine-admin" data-testid="admin-page">
      <style>{ENGINE_ADMIN_CSS}</style>
      <header className="engine-admin-topbar">
        <div><div className="engine-brand-name">BRUNEL</div><div className="engine-brand-sub">admin · engine console</div></div>
        <div className="engine-admin-actions"><button className="engine-btn" onClick={load} disabled={busy}>Refresh</button><button className="engine-btn" onClick={copySnapshot}>Copy Snapshot</button><button className="engine-btn" onClick={downloadSnapshot}>Export JSON</button><button className="engine-btn" onClick={() => navigate("/brunel")}>Back to BRUNEL</button><button className="engine-btn engine-btn-dim" onClick={() => window.confirm("Sign out of BRUNEL?") && signOut()}>Sign out</button></div>
      </header>

      {msg && <div className="engine-message">{msg}</div>}

      <main className="engine-grid">
        <DataBlock title="System Values" subtitle="Fast read of the live engine state." wide>
          <div className="value-grid"><ValueChip label="turns" value={runtimeLast?.turn_count ?? 0} /><ValueChip label="persona" value={seed.persona} /><ValueChip label="state" value={seed.state} /><ValueChip label="mode" value={seed.mode} /><ValueChip label="zone" value={seed.zone} /><ValueChip label="broker" value={brokerPacket.volume ?? engineConfig?.packet_broker?.volume ?? 0} /><ValueChip label="influence" value={(brokerPacket.influence_enabled ?? brokerPacket.influence) ? "yes" : "no"} /><ValueChip label="history cap" value={runtimeFlags.prompt_history_turns} /><ValueChip label="prompt chars" value={(promptWindow.system_prompt || "").length} /><ValueChip label="payload msgs" value={reconstructedModelPayload.message_count} /><ValueChip label="runtime keys" value={(runtimeLast?.runtime_keys || []).length} /></div>
          <div className="egress-stack">{egressStack.map(([label, active]) => <span key={label} className="egress-chip" data-active={active ? "true" : "false"}>{label}</span>)}</div>
        </DataBlock>

        <DataBlock title="Runtime Controls" subtitle="Admin override board. Cartridge defaults come later.">
          <div className="engine-control-row"><label><span>Packet Broker Volume</span><input type="range" min="0" max="100" value={packetVolume} onChange={(e) => setPacketVolume(e.target.value)} /><strong>{packetVolume}</strong></label></div>
          <div className="engine-two-col"><label className="engine-field"><span>Forced State</span><input value={pickState} onChange={(e) => setPickState(e.target.value)} placeholder="natural" /></label><label className="engine-field"><span>Forced Mode</span><input value={pickMode} onChange={(e) => setPickMode(e.target.value)} placeholder="natural" /></label></div>
          <div className="engine-button-row"><button className="engine-btn engine-btn-primary" onClick={applyRuntime} disabled={busy}>{busy ? "Applying..." : "Apply Controls"}</button><button className="engine-btn" onClick={clearOverrides} disabled={busy}>Clear State / Mode</button></div>
        </DataBlock>

        <DataBlock title="Runtime Flags" subtitle="Prompt influence switches. Archive and diagnostics remain available.">
          <div className="engine-control-row"><label><span>Prompt History Turns</span><input type="range" min="0" max="80" value={runtimeFlags.prompt_history_turns ?? 0} onChange={(e) => setFlag("prompt_history_turns", Number(e.target.value))} /><strong>{runtimeFlags.prompt_history_turns ?? 0}</strong></label></div>
          <div className="engine-toggle-grid">{FLAG_LABELS.map(([key, label, sub]) => <button key={key} type="button" className="engine-toggle" data-active={runtimeFlags[key] ? "true" : "false"} onClick={() => setFlag(key, !runtimeFlags[key])}><div className="engine-toggle-title">{runtimeFlags[key] ? "ON" : "OFF"} · {label}</div><div className="engine-toggle-sub">{sub}</div></button>)}</div>
          <div className="engine-button-row"><button className="engine-btn" onClick={resetFlags}>Reset Clean Defaults</button></div>
        </DataBlock>

        <DataBlock title="Active Seed" subtitle="The current response seed reconstructed from runtime packets." actions={<button className="engine-mini-btn" onClick={copySeed}>Copy Seed</button>} wide><div className="seed-strip"><span>persona · {seed.persona}</span><span>state · {seed.state || "—"}</span><span>mode · {seed.mode || "—"}</span><span>zone · {seed.zone || "—"}</span></div><JsonPanel value={seed} maxHeight={260} /></DataBlock>
        <DataBlock title="Signal Meters" subtitle="Agent weights and tribunal levels coming out of the engine."><div className="engine-meter-grid">{Object.entries(signals).map(([key, value]) => <EngineMeter key={key} label={key} value={value} />)}</div><div className="tribunal-strip">{Object.entries(tribunal).map(([key, value]) => <span key={key}>{key} · {value}</span>)}</div></DataBlock>
        <DataBlock title="Packet Broker" subtitle="Last packet broker summary and influence report."><div className="seed-strip"><span>volume · {brokerPacket.volume ?? engineConfig?.packet_broker?.volume ?? 0}</span><span>influence · {(brokerPacket.influence_enabled ?? brokerPacket.influence) ? "yes" : "no"}</span><span>packets · {(brokerPacket.packets || []).length}</span></div><JsonPanel value={brokerPacket} maxHeight={260} /></DataBlock>
        <DataBlock title="Memory / Context" subtitle="Working memory, prompt memories, entropy, and presearch."><div className="seed-strip"><span>working · {memoryPacket.working_memory || "—"}</span><span>external · {memoryPacket.external_memory_count ?? 0}</span><span>prompt memories · {(memoryPacket.prompt_memory_context || []).length}</span></div><JsonPanel value={memoryPacket} maxHeight={320} /></DataBlock>
        <DataBlock title="PROMPT WINDOW" subtitle="Final assembled system prompt leaving Core for the model." actions={<button className="engine-mini-btn" onClick={copyPrompt}>Copy Prompt</button>} wide><div className="seed-strip"><span>stage · {promptWindow?.metadata?.capture_stage || "—"}</span><span>egress messages · reconstructed</span><span>chars · {(promptWindow.system_prompt || "").length}</span></div><TextPanel value={promptWindow.system_prompt} /></DataBlock>
        <DataBlock title="Model Payload" subtitle="Reconstructed egress payload using current runtime flag settings." actions={<button className="engine-mini-btn" onClick={copyPayload}>Copy Payload</button>} wide><JsonPanel value={reconstructedModelPayload} maxHeight={520} /></DataBlock>
        <DataBlock title="Prompt Sections" subtitle="PROMPT WINDOW sections extracted for inspection." wide><JsonPanel value={promptSections} maxHeight={420} /></DataBlock>
        <DataBlock title="Full Runtime Packet" subtitle="Everything captured from the engine for the last turn." wide><JsonPanel value={runtime} maxHeight={520} /></DataBlock>
      </main>
    </div>
  );
}
