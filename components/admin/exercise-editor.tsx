"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
type Exercise = {
  id?: string;
  slug: string;
  name_pt: string;
  name_en: string | null;
  category: string;
  movement_pattern: string;
  difficulty: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  execution_instructions: string[];
  breathing_instruction: string | null;
  common_errors: string[];
  active: boolean;
};
type Media = {
  id: string;
  storage_path: string | null;
  status: string;
  media_type: string;
  angle: string;
  attribution: string | null;
};
export function ExerciseEditor({
  exercise,
  media = [],
}: {
  exercise?: Exercise;
  media?: Media[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function submit(data: FormData) {
    setBusy(true);
    const payload = {
      slug: String(data.get("slug")),
      name_pt: String(data.get("name")),
      name_en: String(data.get("nameEn") || "") || null,
      category: String(data.get("category")),
      movement_pattern: String(data.get("pattern")),
      difficulty: String(data.get("difficulty")),
      primary_muscles: String(data.get("primary") || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      secondary_muscles: String(data.get("secondary") || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      execution_instructions: String(data.get("instructions") || "")
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
      breathing_instruction: String(data.get("breathing") || "") || null,
      common_errors: String(data.get("errors") || "")
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
      active: data.get("active") === "on",
    };
    const supabase = createClient();
    const result = exercise?.id
      ? await supabase.from("exercises").update(payload).eq("id", exercise.id)
      : await supabase.from("exercises").insert(payload).select("id").single();
    if (result.error) toast.error(result.error.message);
    else {
      toast.success("Exercício salvo");
      router.replace(`/admin/exercises/${exercise?.id ?? result.data?.id}`);
      router.refresh();
    }
    setBusy(false);
  }
  async function mediaAction(
    id: string,
    action: "reject" | "delete",
    path: string | null,
  ) {
    const supabase = createClient();
    const result =
      action === "delete"
        ? await supabase.from("exercise_media").delete().eq("id", id)
        : await supabase
            .from("exercise_media")
            .update({ status: "rejected", execution_quality: "rejected" })
            .eq("id", id);
    if (!result.error && action === "delete" && path)
      await supabase.storage.from("exercise-media").remove([path]);
    if (result.error) toast.error(result.error.message);
    else toast.success("Mídia atualizada");
    router.refresh();
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <form
        action={submit}
        className="space-y-5 rounded-2xl border bg-surface p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" name="name" value={exercise?.name_pt} />
          <Field label="Slug" name="slug" value={exercise?.slug} />
          <Field
            label="Nome em inglês"
            name="nameEn"
            value={exercise?.name_en ?? ""}
          />
          <Select
            label="Categoria"
            name="category"
            value={exercise?.category ?? "strength"}
            options={["strength", "cardio", "mobility"]}
          />
          <Select
            label="Padrão de movimento"
            name="pattern"
            value={exercise?.movement_pattern ?? "squat"}
            options={[
              "squat",
              "hinge",
              "horizontal_push",
              "vertical_push",
              "horizontal_pull",
              "vertical_pull",
              "carry",
              "core_anti_extension",
              "core_anti_rotation",
              "core_flexion",
              "hip_extension",
              "knee_extension",
              "knee_flexion",
              "cardio",
              "mobility",
              "posture",
            ]}
          />
          <Select
            label="Dificuldade"
            name="difficulty"
            value={exercise?.difficulty ?? "beginner"}
            options={["beginner", "intermediate", "advanced"]}
          />
          <Field
            label="Músculos principais (vírgulas)"
            name="primary"
            value={exercise?.primary_muscles.join(", ")}
          />
          <Field
            label="Secundários"
            name="secondary"
            value={exercise?.secondary_muscles.join(", ")}
          />
        </div>
        <Area
          label="Execução (um passo por linha)"
          name="instructions"
          value={exercise?.execution_instructions.join("\n")}
        />
        <Area
          label="Respiração"
          name="breathing"
          value={exercise?.breathing_instruction ?? ""}
        />
        <Area
          label="Erros comuns (um por linha)"
          name="errors"
          value={exercise?.common_errors.join("\n")}
        />
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            name="active"
            type="checkbox"
            defaultChecked={exercise?.active}
            className="size-5 accent-[var(--accent)]"
          />
          Ativo para geração (exige mídia aprovada)
        </label>
        <Button disabled={busy}>
          {busy ? "Salvando…" : "Salvar exercício"}
        </Button>
      </form>
      <aside className="rounded-2xl border bg-surface p-5">
        <h2 className="font-semibold">Mídia</h2>
        {exercise?.id ? (
          <>
            <Button asChild className="mt-4 w-full">
              <Link href={`/admin/media-review?exercise=${exercise.id}`}>
                Abrir biblioteca de mídia
              </Link>
            </Button>
            <div className="mt-5 space-y-3">
              {media.map((item) => (
                <div key={item.id} className="rounded-xl bg-surface-alt p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {item.angle} · {item.media_type}
                    </span>
                    <span className="text-xs text-muted">{item.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.status !== "approved" && (
                      <Button asChild size="default">
                        <Link href={`/admin/media-review?media=${item.id}`}>
                          Revisar
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() =>
                        mediaAction(item.id, "reject", item.storage_path)
                      }
                    >
                      Rejeitar
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() =>
                        mediaAction(item.id, "delete", item.storage_path)
                      }
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Salve o exercício antes de enviar mídia.
          </p>
        )}
      </aside>
    </div>
  );
}
function Field({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value?: string;
}) {
  return (
    <label className="text-sm">
      {label}
      <Input
        className="mt-2"
        name={name}
        defaultValue={value}
        required={["name", "slug"].includes(name)}
      />
    </label>
  );
}
function Area({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value?: string;
}) {
  return (
    <label className="block text-sm">
      {label}
      <textarea
        className="mt-2 min-h-24 w-full rounded-xl border bg-surface p-3"
        name={name}
        defaultValue={value}
      />
    </label>
  );
}
function Select({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: string[];
}) {
  return (
    <label className="text-sm">
      {label}
      <select
        className="mt-2 h-12 w-full rounded-xl border bg-surface px-3"
        name={name}
        defaultValue={value}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
