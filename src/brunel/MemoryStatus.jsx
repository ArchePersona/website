import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext.jsx';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://brunel-5lxo.onrender.com';
const API = `${BACKEND_URL}/api`;

const CSS = `
.memory-status-page { min-height: 100dvh; padding: 14px; background: #05080b; color: #e8fff0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.memory-status-card { border: 1px solid rgba(80,255,150,0.18); background: rgba(8,14,20,0.92); }
.memory-status-head { display: flex; justify-content: space-between; gap: 10px; padding: 12px; border-bottom: 1px solid rgba(80,255,150,0.12); background: rgba(80,255,150,0.035); }
.memory-status-title { color: #7dffae; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; }
.memory-status-sub { color: rgba(232,255,240,0.58); font-size: 9px; margin-top: 4px; }
.memory-status-actions { display: flex; flex-wrap: wrap; gap: 7px; }
.memory-status-btn { background: transparent; border: 1px solid rgba(80,255,150,0.24); color: #7dffae; font: inherit; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; padding: 8px 10px; }
.memory-status-body { padding: 12px; }
.memory-status-grid { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 12px; }
.memory-status-chip { display: inline-flex; border: 1px solid rgba(232,255,240,0.14); color: rgba(232,255,240,0.72); background: rgba(255,255,255,0.025); padding: 4px 8px; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
.memory-status-chip strong { color: #7dffae; margin-left: 6px; }
.memory-status-json { white-space: pre-wrap; word-break: break-word; overflow: auto; max-height: 70dvh; background: rgba(0,0,0,0.42); color: #e8fff0; border: 1px solid rgba(232,255,240,0.12); padding: 12px; font-size: 11px; line-height: 1.55; }
.memory-status-msg { color: #d7b35a; margin-bottom: 10px; font-size: 11px; }
`;

function safeJson(value) {
  try { return JSON.stringify(value ?? {}, null, 2); } catch (_) { return '{}'; }
}

function bytes(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, idx)).toFixed(idx ? 1 : 0)} ${units[idx]}`;
}

function Chip({ label, value }) {
  return <span className="memory-status-chip">{label}<strong>{String(value ?? '—')}</strong></span>;
}

export default function MemoryStatus() {
  const { session } = useAuth();
  const authHeader = useMemo(() => (session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}), [session?.access_token]);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setMsg('');
    try {
      const res = await axios.get(`${API}/memory/status`, { headers: authHeader });
      setStatus(res.data || {});
    } catch (e) {
      setMsg(e?.response?.data?.detail || e.message);
    }
  }, [authHeader, session?.access_token]);

  useEffect(() => { load(); }, [load]);

  const copy = async () => {
    await navigator.clipboard.writeText(safeJson(status));
    setMsg('memory status copied');
  };

  return (
    <div className="memory-status-page">
      <style>{CSS}</style>
      <section className="memory-status-card">
        <div className="memory-status-head">
          <div>
            <div className="memory-status-title">LOCAL MEMORY BODY</div>
            <div className="memory-status-sub">Persistent Render disk status for BRUNEL chronological memory.</div>
          </div>
          <div className="memory-status-actions">
            <button className="memory-status-btn" onClick={load}>Refresh</button>
            <button className="memory-status-btn" onClick={copy}>Copy</button>
          </div>
        </div>
        <div className="memory-status-body">
          {msg && <div className="memory-status-msg">{msg}</div>}
          <div className="memory-status-grid">
            <Chip label="ok" value={status?.ok ? 'yes' : 'no'} />
            <Chip label="env" value={status?.env_present ? 'set' : 'missing'} />
            <Chip label="exists" value={status?.exists ? 'yes' : 'no'} />
            <Chip label="writable" value={status?.writable ? 'yes' : 'no'} />
            <Chip label="memory dir" value={status?.memory_dir || '—'} />
            <Chip label="free" value={bytes(status?.disk?.free_bytes)} />
            <Chip label="used" value={bytes(status?.disk?.used_bytes)} />
            <Chip label="recent files" value={(status?.recent_files || []).length} />
          </div>
          <pre className="memory-status-json">{safeJson(status)}</pre>
        </div>
      </section>
    </div>
  );
}
