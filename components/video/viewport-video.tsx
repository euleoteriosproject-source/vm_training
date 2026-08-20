"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function motionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function subscribeConnection(callback: () => void) {
  const connection = (navigator as Navigator & { connection?: EventTarget })
    .connection;
  connection?.addEventListener("change", callback);
  return () => connection?.removeEventListener("change", callback);
}
function saveDataSnapshot() {
  return Boolean(
    (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData,
  );
}

export function ExercisePreviewVideo({
  src,
  poster,
  className = "",
  priority = false,
  mediaType = "video",
}: {
  src?: string | null;
  poster?: string | null;
  className?: string;
  priority?: boolean;
  mediaType?: "gif" | "video" | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [manual, setManual] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    motionSnapshot,
    () => true,
  );
  const saveData = useSyncExternalStore(
    subscribeConnection,
    saveDataSnapshot,
    () => true,
  );
  const autoplayBlocked = reduced || saveData;
  const showAnimatedGif = mediaType === "gif" && (!autoplayBlocked || manual);
  useEffect(() => {
    const node = ref.current;
    if (!node || !src || autoplayBlocked || manual) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void node.play().catch(() => undefined);
        else node.pause();
      },
      { threshold: 0.55, rootMargin: "80px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [src, autoplayBlocked, manual]);
  async function play() {
    setManual(true);
    await ref.current?.play().catch(() => undefined);
  }
  if (!src)
    return (
      <div
        className={`grid aspect-video place-items-center bg-surface-alt px-4 text-center text-xs text-muted ${className}`}
      >
        <span>Demonstração em revisão</span>
      </div>
    );
  if (mediaType === "gif")
    return (
      <div className={`relative overflow-hidden bg-black ${className}`}>
        <Image
          data-testid={
            showAnimatedGif ? "exercise-preview-gif" : "exercise-preview-poster"
          }
          src={(showAnimatedGif ? src : poster) ?? src}
          alt="Demonstração animada do exercício"
          width={720}
          height={540}
          unoptimized
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          className="h-auto w-full object-contain"
        />
        {autoplayBlocked && !manual && poster && (
          <button
            onClick={() => setManual(true)}
            aria-label="Ver execução animada"
            className="absolute inset-0 grid place-items-center bg-black/20"
          >
            <span className="rounded-full bg-black/75 px-4 py-2 text-sm font-medium text-white">
              Ver execução
            </span>
          </button>
        )}
      </div>
    );
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <video
        data-testid="exercise-preview-video"
        ref={ref}
        className="aspect-video w-full object-cover"
        src={src}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        preload={priority ? "metadata" : "none"}
        controls={false}
      />
      {autoplayBlocked && !manual && (
        <button
          onClick={play}
          aria-label="Reproduzir demonstração"
          className="absolute inset-0 grid place-items-center bg-black/20"
        >
          <span className="grid size-12 place-items-center rounded-full bg-black/70 text-white">
            <Play size={21} fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
}
export const ViewportVideo = ExercisePreviewVideo;
