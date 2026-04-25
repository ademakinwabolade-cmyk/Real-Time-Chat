import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoicePlayerProps {
  audioId: number;
  durationMs: number;
  isMine: boolean;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoicePlayer({ audioId, durationMs, isMine }: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState<number | null>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setPosition(a.currentTime);
    const onMeta = () => {
      if (Number.isFinite(a.duration)) setLoadedDuration(a.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setPosition(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play();
      setPlaying(true);
    }
  }

  const totalSec = loadedDuration ?? durationMs / 1000;
  const progress = totalSec > 0 ? Math.min(1, position / totalSec) : 0;
  const display = playing
    ? formatTime(position)
    : formatTime(loadedDuration ?? durationMs / 1000);

  const trackBg = isMine ? "bg-primary-foreground/30" : "bg-foreground/15";
  const trackFill = isMine ? "bg-primary-foreground" : "bg-foreground";
  const textColor = isMine ? "text-primary-foreground" : "text-foreground";
  const buttonStyle = isMine
    ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
    : "bg-foreground/10 hover:bg-foreground/15 text-foreground";

  return (
    <div className={`flex items-center gap-3 min-w-[200px] ${textColor}`}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={`h-9 w-9 rounded-full shrink-0 ${buttonStyle}`}
        onClick={toggle}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </Button>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className={`h-1 rounded-full overflow-hidden ${trackBg}`}>
          <div
            className={`h-full rounded-full transition-[width] ${trackFill}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-[11px] tabular-nums opacity-80">{display}</span>
      </div>
      <audio
        ref={audioRef}
        src={`${basePath}/api/dm-audio/${audioId}`}
        preload="metadata"
      />
    </div>
  );
}
