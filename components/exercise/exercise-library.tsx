"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Dumbbell, Search, Video } from "lucide-react";
import { ExerciseDetails, type ExerciseDetail } from "./exercise-details";
import { ExercisePreviewVideo } from "@/components/video/viewport-video";
import { Card } from "@/components/ui/card";

export type ExerciseLibraryItem = ExerciseDetail & {
  id: string;
  slug: string;
  movementPattern: string;
  difficulty: string;
  mediaReady: boolean;
  autoPlanEligible: boolean;
  mediaType: "gif" | "video" | null;
};

function label(value: string) {
  return value.replaceAll("_", " ");
}

export function ExerciseLibrary({ items }: { items: ExerciseLibraryItem[] }) {
  const [search, setSearch] = useState("");
  const [movement, setMovement] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const options = useMemo(
    () => ({
      movements: [...new Set(items.map((item) => item.movementPattern))].sort(),
      muscles: [...new Set(items.flatMap((item) => item.primaryMuscles))].sort(),
      equipment: [...new Set(items.flatMap((item) => item.equipment ?? []))].sort(),
    }),
    [items],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return items.filter(
      (item) =>
        (!term ||
          item.name.toLocaleLowerCase("pt-BR").includes(term) ||
          item.primaryMuscles.some((value) =>
            value.toLocaleLowerCase("pt-BR").includes(term),
          )) &&
        (!movement || item.movementPattern === movement) &&
        (!muscle || item.primaryMuscles.includes(muscle)) &&
        (!equipment || item.equipment?.includes(equipment)),
    );
  }, [equipment, items, movement, muscle, search]);

  return (
    <>
      <Card className="mt-6 grid gap-3 p-4 md:grid-cols-4">
        <label className="relative md:col-span-4">
          <span className="sr-only">Buscar exercício</span>
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-3.5 text-muted"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar exercício ou músculo"
            className="min-h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm outline-none focus:border-accent"
          />
        </label>
        <Filter
          label="Movimento"
          value={movement}
          options={options.movements}
          onChange={setMovement}
        />
        <Filter
          label="Músculo"
          value={muscle}
          options={options.muscles}
          onChange={setMuscle}
        />
        <Filter
          label="Equipamento"
          value={equipment}
          options={options.equipment}
          onChange={setEquipment}
        />
        <div className="flex min-h-11 items-center text-sm text-muted">
          {filtered.length} de {items.length} exercícios
        </div>
      </Card>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => (
          <ExerciseDetails
            key={item.id}
            exercise={item}
            trigger={
              <button className="w-full text-left" aria-label={`Ver ${item.name}`}>
                <Card className="h-full overflow-hidden transition hover:border-accent/50">
                  <ExercisePreviewVideo
                    src={item.mediaUrl}
                    poster={item.posterUrl}
                    mediaType={item.mediaType}
                    playbackControl={false}
                    className="aspect-video w-full"
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{item.name}</h2>
                        <p className="mt-1 text-sm text-muted">
                          {item.primaryMuscles.join(" · ")}
                        </p>
                      </div>
                      {item.autoPlanEligible && (
                        <CheckCircle2
                          size={18}
                          className="shrink-0 text-success"
                          aria-label="Disponível para o seu plano"
                        />
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
                      <span className="rounded-full bg-surface-alt px-2 py-1">
                        {label(item.movementPattern)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-2 py-1">
                        <Dumbbell size={12} />
                        {item.equipment?.join(", ") || "Peso corporal"}
                      </span>
                      {item.mediaReady && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-success">
                          <Video size={12} /> Demonstração
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </button>
            }
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <Card className="mt-5 p-8 text-center text-muted">
          Nenhum exercício combina com estes filtros.
        </Card>
      )}
    </>
  );
}

function Filter({
  label: filterLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted">
      {filterLabel}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-xl border bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {label(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
