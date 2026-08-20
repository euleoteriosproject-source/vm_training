"use client";
import { useRef, useState } from "react";
import { Pause, Play, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ExercisePreviewVideo } from "@/components/video/viewport-video";
export type ExerciseDetail = {
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  breathing: string | null;
  errors: string[];
  equipment?: string[];
  mediaUrl?: string | null;
  posterUrl?: string | null;
  mediaType?: "gif" | "video" | null;
  mediaSource?: {
    author: string | null;
    sourceName: string | null;
    licenseCode: string | null;
    licenseUrl: string | null;
    sourceUrl: string | null;
    attributionText: string | null;
  } | null;
};
export function ExerciseDetails({ exercise }: { exercise: ExerciseDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        Execução
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title="Como fazer">
        <ExercisePlayer
          src={exercise.mediaUrl}
          poster={exercise.posterUrl}
          mediaType={exercise.mediaType}
        />
        <h2 className="mt-5 text-2xl font-semibold">{exercise.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {exercise.primaryMuscles.join(" · ")}
        </p>
        <section className="mt-7">
          <h3 className="font-semibold">Como executar</h3>
          <ol className="mt-3 space-y-3">
            {exercise.instructions.map((item, index) => (
              <li key={item} className="flex gap-3 text-sm leading-6">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs text-accent-foreground">
                  {index + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </section>
        {exercise.breathing && (
          <section className="mt-6">
            <h3 className="font-semibold">Respiração</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              {exercise.breathing}
            </p>
          </section>
        )}
        <section className="mt-6">
          <h3 className="font-semibold">Evite</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
            {exercise.errors.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="mt-6">
          <h3 className="font-semibold">Músculos trabalhados</h3>
          <p className="mt-2 text-sm text-muted">
            <strong className="text-foreground">Principal:</strong>{" "}
            {exercise.primaryMuscles.join(", ")}
            <br />
            <strong className="text-foreground">Secundários:</strong>{" "}
            {exercise.secondaryMuscles.join(", ") || "—"}
          </p>
        </section>
        {exercise.equipment?.length ? (
          <section className="mt-6">
            <h3 className="font-semibold">Equipamento</h3>
            <p className="mt-2 text-sm text-muted">
              {exercise.equipment.join(", ")}
            </p>
          </section>
        ) : null}
        {exercise.mediaSource && (
          <details className="mt-7 rounded-xl border p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Sobre este vídeo
            </summary>
            <dl className="mt-4 grid gap-2 text-sm">
              <Data
                label="Autor"
                value={exercise.mediaSource.author || "Não informado"}
              />
              <Data
                label="Fonte"
                value={exercise.mediaSource.sourceName || "Não informada"}
              />
              <Data
                label="Licença"
                value={exercise.mediaSource.licenseCode || "Não informada"}
              />
            </dl>
            {exercise.mediaSource.attributionText && (
              <p className="mt-3 text-xs leading-5 text-muted">
                {exercise.mediaSource.attributionText}
              </p>
            )}
            <div className="mt-3 flex gap-4 text-xs text-accent">
              {exercise.mediaSource.sourceUrl && (
                <a
                  href={exercise.mediaSource.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Link original
                </a>
              )}
              {exercise.mediaSource.licenseUrl && (
                <a
                  href={exercise.mediaSource.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver licença
                </a>
              )}
            </div>
          </details>
        )}
      </Sheet>
    </>
  );
}
function ExercisePlayer({
  src,
  poster,
  mediaType,
}: {
  src?: string | null;
  poster?: string | null;
  mediaType?: "gif" | "video" | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  async function toggle() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }
  function changeSpeed(value: number) {
    setSpeed(value);
    if (ref.current) ref.current.playbackRate = value;
  }
  if (!src)
    return (
      <div className="grid aspect-video w-full place-items-center rounded-2xl bg-surface-alt text-sm text-muted">
        Demonstração em revisão
      </div>
    );
  if (mediaType === "gif")
    return (
      <ExercisePreviewVideo
        src={src}
        poster={poster}
        mediaType="gif"
        priority
        className="w-full rounded-2xl"
      />
    );
  return (
    <div>
      <video
        data-testid="exercise-detail-video"
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        className="aspect-video w-full rounded-2xl bg-black object-contain"
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={toggle}
          aria-label={playing ? "Pausar" : "Reproduzir"}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </Button>
        {[0.5, 1].map((value) => (
          <Button
            key={value}
            variant={speed === value ? "primary" : "secondary"}
            onClick={() => changeSpeed(value)}
          >
            {value}×
          </Button>
        ))}
        <Button
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            if (ref.current) {
              ref.current.currentTime = 0;
              void ref.current.play();
            }
          }}
        >
          <Repeat2 size={17} />
          Repetir
        </Button>
      </div>
    </div>
  );
}
function Data({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
