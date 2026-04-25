import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Trash2, Send, Square } from "lucide-react";

interface VoiceRecorderProps {
  onSend: (params: {
    audioBase64: string;
    mimeType: string;
    durationMs: number;
  }) => Promise<void> | void;
  disabled?: boolean;
}

function pickMime(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(c)
    ) {
      return c;
    }
  }
  return "audio/webm";
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[],
    );
  }
  return btoa(binary);
}

export function VoiceRecorder({ onSend, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<{
    blob: Blob;
    url: string;
    durationMs: number;
    mimeType: string;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopStream();
      if (preview) URL.revokeObjectURL(preview.url);
      if (tickerRef.current) window.clearInterval(tickerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMime();
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const durationMs = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setPreview({ blob, url, durationMs, mimeType });
        stopStream();
      };
      mr.start();
      recorderRef.current = mr;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      tickerRef.current = window.setInterval(() => {
        setElapsed(Date.now() - startedAtRef.current);
      }, 200);
    } catch (err) {
      setError("Microphone access was denied.");
      console.error(err);
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
    if (tickerRef.current) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }

  function discard() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setElapsed(0);
  }

  async function send() {
    if (!preview) return;
    setSending(true);
    try {
      const audioBase64 = await blobToBase64(preview.blob);
      await onSend({
        audioBase64,
        mimeType: preview.mimeType,
        durationMs: Math.max(1, preview.durationMs),
      });
      discard();
    } catch (err) {
      setError("Failed to send voice message.");
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  if (preview) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-card border border-input rounded-2xl">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive"
          onClick={discard}
          disabled={sending}
          title="Discard"
        >
          <Trash2 size={16} />
        </Button>
        <audio
          src={preview.url}
          controls
          className="flex-1 h-9 min-w-0"
          preload="metadata"
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatTime(preview.durationMs)}
        </span>
        <Button
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={send}
          disabled={sending || disabled}
          title="Send voice message"
        >
          <Send size={14} />
        </Button>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-card border border-input rounded-2xl">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
        </span>
        <span className="text-sm text-muted-foreground flex-1">
          Recording... {formatTime(elapsed)}
        </span>
        <Button
          size="icon"
          variant="destructive"
          className="h-9 w-9 rounded-xl"
          onClick={stopRecording}
          title="Stop recording"
        >
          <Square size={14} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground"
        onClick={startRecording}
        disabled={disabled}
        title="Record voice message"
      >
        <Mic size={18} />
      </Button>
      {error && (
        <span className="text-[10px] text-destructive max-w-[200px] text-right">
          {error}
        </span>
      )}
    </div>
  );
}
