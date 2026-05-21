import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Send, LogOut, Shield, Copy, ClipboardCopy, Mic, Square } from "lucide-react";
import { useAuth } from "@/AuthContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function Chat() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  const sessionId = user?.id || "";
  const isAdmin = (user?.email || "").toLowerCase() === "archepersona@gmail.com";

  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const scrollRef = useRef(null);
  const mediaRecRef = useRef(null);
  const audioChunksRef = useRef([]);

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
    return () => {
      cancelled = true;
    };
  }, [sessionId, session?.access_token, authHeader]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const send = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setText("");
    const nowIso = new Date().toISOString();
    setMessages((m) => [...m, { role: "user", content: msg, ts: nowIso }]);

    try {
      const r = await axios.post(
        `${API}/chat`,
        { message: msg, target: "rk_only" },
        { headers: authHeader }
      );
      const d = r.data;
      if (d.rk_response) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: d.rk_response, ts: new Date().toISOString() },
        ]);
      }
    } catch (e) {
      console.error(e);
      const errMsg = `[ link to engine failed — ${e?.response?.data?.detail || e.message} ]`;
      setMessages((m) => [
        ...m,
        { role: "assistant", content: errMsg, ts: new Date().toISOString() },
      ]);
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

  // ------------------------------------------------------------------
  // Pair the messages into [{user, assistant}, ...] so we can render
  // one copy button per ask/answer block. Trailing user-without-assistant
  // (BRUNEL still thinking) is rendered alone.
  // ------------------------------------------------------------------
  const pairs = useMemo(() => {
    const out = [];
    let pending = null;
    for (const m of messages) {
      if (m.role === "user") {
        if (pending) out.push(pending);
        pending = { user: m.content, userTs: m.ts || null, assistant: null, assistantTs: null };
      } else {
        if (pending) {
          pending.assistant = m.content;
          pending.assistantTs = m.ts || null;
          out.push(pending);
          pending = null;
        } else {
          out.push({ user: null, userTs: null, assistant: m.content, assistantTs: m.ts || null });
        }
      }
    }
    if (pending) out.push(pending);
    return out;
  }, [messages]);

  // HH:MM/DD/MM/YY in local time
  const fmtTs = (iso) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(d.getHours())}:${pad(d.getMinutes())}/${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
    } catch {
      return "";
    }
  };

  const formatPair = (p) => {
    const lines = [];
    if (p.user) lines.push(`You: ${p.user}`);
    if (p.assistant) lines.push(`BRUNEL: ${p.assistant}`);
    const ts = fmtTs(p.assistantTs || p.userTs);
    if (ts) lines.push(`— ${ts}`);
    return lines.join("\n\n");
  };

  const formatThread = () =>
    pairs
      .map(formatPair)
      .filter(Boolean)
      .join("\n\n---\n\n");

  const copyToClipboard = async (str, key) => {
    try {
      await navigator.clipboard.writeText(str);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1400);
    } catch (e) {
      console.warn("clipboard failed", e);
    }
  };

  // ------------------------------------------------------------------
  // Voice → text (Whisper)
  // ------------------------------------------------------------------
  const startRecording = async () => {
    if (recording || transcribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        // stop the mic
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioChunksRef.current = [];
        if (blob.size === 0) {
          setTranscribing(false);
          return;
        }
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "voice.webm");
          const r = await axios.post(`${API}/transcribe`, form, {
            headers: { ...authHeader, "Content-Type": "multipart/form-data" },
          });
          const tx = (r.data?.text || "").trim();
          if (tx) {
            setText((prev) => (prev ? prev + " " + tx : tx));
          }
        } catch (e) {
          console.error("transcribe failed", e);
          alert("Transcription failed: " + (e?.response?.data?.detail || e.message));
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      console.error("mic permission denied", e);
      alert("Microphone access is required. Allow it and try again.");
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    setRecording(false);
    try {
      mediaRecRef.current?.stop();
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <div className="app" data-testid="app-root">
      <div className="topbar">
        <div className="brand">
          <div className="brand-name">BRUNEL</div>
          <div className="brand-rule" />
          <div className="brand-sub">Powered by ARCHE</div>
        </div>
        <div className="topbar-right">
          <span className="session-id" data-testid="user-email">
            {user?.email || "—"}
          </span>

          <button
            className="reset-btn"
            onClick={() => copyToClipboard(formatThread(), "thread")}
            disabled={pairs.length === 0}
            title="Copy entire conversation"
            data-testid="copy-thread-btn"
          >
            <ClipboardCopy size={11} style={{ marginRight: 6, verticalAlign: "-1px" }} />
            <span className="reset-btn-label">
              {copiedKey === "thread" ? "Copied" : "Copy thread"}
            </span>
          </button>

          {isAdmin && (
            <button
              className="reset-btn"
              onClick={() => navigate("/admin")}
              data-testid="admin-link-btn"
              title="Admin override panel"
            >
              <Shield size={11} style={{ marginRight: 6, verticalAlign: "-1px" }} />
              <span className="reset-btn-label">Admin</span>
            </button>
          )}

          <button
            className="reset-btn"
            onClick={() => {
              if (window.confirm("Sign out of BRUNEL?")) signOut();
            }}
            data-testid="signout-btn"
            aria-label="Sign out"
          >
            <LogOut size={11} style={{ marginRight: 6, verticalAlign: "-1px" }} />
            <span className="reset-btn-label">Sign out</span>
          </button>
        </div>
      </div>

      <div className="panel panel-rk solo" data-testid="panel-rk">
        <div className="chat-body" ref={scrollRef} data-testid="chat-body">
          {pairs.length === 0 ? (
            <div className="empty-state">say something — i&rsquo;ll remember it</div>
          ) : (
            pairs.map((p, i) => (
              <div key={i} className="pair" data-testid={`pair-${i}`}>
                {p.user && (
                  <div className="bubble bubble-user" data-testid={`bubble-user-${i}`}>
                    {p.user}
                  </div>
                )}
                {p.assistant && (
                  <div className="bubble bubble-assistant" data-testid={`bubble-assistant-${i}`}>
                    {p.assistant}
                  </div>
                )}
                {(p.assistantTs || p.userTs) && (
                  <div className="pair-timestamp" data-testid={`pair-ts-${i}`}>
                    {fmtTs(p.assistantTs || p.userTs)}
                  </div>
                )}
                <button
                  className="copy-pair-btn"
                  onClick={() => copyToClipboard(formatPair(p), `pair-${i}`)}
                  title="Copy this exchange"
                  data-testid={`copy-pair-${i}`}
                >
                  <Copy size={11} style={{ marginRight: 4, verticalAlign: "-1px" }} />
                  {copiedKey === `pair-${i}` ? "copied" : "copy"}
                </button>
              </div>
            ))
          )}
          {sending && (
            <div className="thinking" data-testid="thinking">
              considering
            </div>
          )}
        </div>

        <div className="panel-input">
          <div className="input-row">
            <textarea
              className="input"
              placeholder={
                transcribing
                  ? "transcribing…"
                  : recording
                  ? "listening — tap stop when done"
                  : "Say something real..."
              }
              value={text}
              disabled={sending || transcribing}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              data-testid="chat-textarea"
            />

            {!recording ? (
              <button
                className="mic-btn"
                onClick={startRecording}
                disabled={sending || transcribing}
                aria-label="record voice"
                title="Tap to talk"
                data-testid="mic-start-btn"
              >
                <Mic size={14} />
              </button>
            ) : (
              <button
                className="mic-btn mic-btn-recording"
                onClick={stopRecording}
                aria-label="stop recording"
                title="Stop"
                data-testid="mic-stop-btn"
              >
                <Square size={14} />
              </button>
            )}

            <button
              className="send"
              onClick={send}
              disabled={sending || transcribing || !text.trim()}
              aria-label="send"
              data-testid="chat-send"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="footnote">
        <span>BRUNEL · An ArchePersona product</span>
        <span className="footnote-tag">Powered by ARCHE</span>
      </div>
    </div>
  );
}

export default Chat;
