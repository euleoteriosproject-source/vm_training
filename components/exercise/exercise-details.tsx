"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  ImageOff,
  Maximize2,
  Pause,
  Play,
  Repeat2,
  SwitchCamera,
} from "lucide-react";
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

type Prescription = {
  sets: number;
  repMin: number | null;
  repMax: number | null;
  restSeconds: number;
};

export function ExerciseDetails({
  exercise,
  trigger,
  prescription,
  onEquipmentUnavailable,
  onChangeExercise,
}: {
  exercise: ExerciseDetail;
  trigger?: ReactNode;
  prescription?: Prescription;
  onEquipmentUnavailable?: () => void;
  onChangeExercise?: () => void;
}) {
  return (
    <Sheet
      trigger={
        trigger ?? (
          <Button type="button" variant="ghost">
            Execução
          </Button>
        )
      }
      title="Como fazer"
    >
      <ExercisePlayer
        src={exercise.mediaUrl}
        poster={exercise.posterUrl}
        mediaType={exercise.mediaType}
      />
      <h2 className="mt-5 text-2xl font-semibold">{exercise.name}</h2>
      <p className="mt-1 text-sm text-muted">
        {exercise.primaryMuscles.join(" · ")}
      </p>
      {prescription && (
        <dl className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-surface-alt p-4 text-center text-sm">
          <Data label="Séries" value={String(prescription.sets)} stacked />
          <Data
            label="Repetições"
            value={formatRepetitions(prescription)}
            stacked
          />
          <Data
            label="Descanso"
            value={`${prescription.restSeconds}s`}
            stacked
          />
        </dl>
      )}
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
            Sobre esta demonstração
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
      {(onEquipmentUnavailable || onChangeExercise) && (
        <div className="sticky bottom-0 -mx-5 mt-7 grid gap-2 border-t bg-background p-5">
          {onEquipmentUnavailable && (
            <Button variant="secondary" onClick={onEquipmentUnavailable}>
              Minha academia não tem
            </Button>
          )}
          {onChangeExercise && (
            <Button variant="secondary" onClick={onChangeExercise}>
              <SwitchCamera size={17} />
              Trocar exercício
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function formatRepetitions(prescription: Prescription) {
  if (prescription.repMin === null) return "Por tempo";
  if (
    prescription.repMax === null ||
    prescription.repMin === prescription.repMax
  )
    return String(prescription.repMin);
  return `${prescription.repMin}–${prescription.repMax}`;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [gifPlaying, setGifPlaying] = useState(true);
  const [gifVersion, setGifVersion] = useState(0);

  async function toggleVideo() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await video.play();
    else video.pause();
  }
  function changeSpeed(value: number) {
    setSpeed(value);
    if (videoRef.current) videoRef.current.playbackRate = value;
  }
  if (!src)
    return (
      <div className="flex w-full items-center gap-3 rounded-2xl bg-surface-alt p-4 text-sm text-muted">
        <ImageOff className="shrink-0" size={20} />
        <span>Vídeo ainda não disponível. Siga as instruções abaixo.</span>
      </div>
    );
  if (mediaType === "gif")
    return (
      <div ref={frameRef}>
        <ExercisePreviewVideo
          key={gifVersion}
          src={gifPlaying ? src : (poster ?? src)}
          poster={poster}
          mediaType={gifPlaying ? "gif" : null}
          priority
          className="w-full rounded-2xl"
        />
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setGifPlaying((value) => !value)}
            aria-label={gifPlaying ? "Pausar" : "Reproduzir"}
          >
            {gifPlaying ? <Pause size={18} /> : <Play size={18} />}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setGifPlaying(true);
              setGifVersion((value) => value + 1);
            }}
          >
            <Repeat2 size={17} />
            Repetir
          </Button>
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => void frameRef.current?.requestFullscreen?.()}
          >
            <Maximize2 size={17} />
            Tela cheia
          </Button>
        </div>
      </div>
    );
  return (
    <div ref={frameRef}>
      <video
        data-testid="exercise-detail-video"
        ref={videoRef}
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
          onClick={toggleVideo}
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
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
              void videoRef.current.play();
            }
          }}
        >
          <Repeat2 size={17} />
          Repetir
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void frameRef.current?.requestFullscreen?.()}
          aria-label="Tela cheia"
        >
          <Maximize2 size={17} />
        </Button>
      </div>
    </div>
  );
}

function Data({
  label,
  value,
  stacked = false,
}: {
  label: string;
  value: string;
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? "grid gap-1" : "flex justify-between gap-4"}>
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
