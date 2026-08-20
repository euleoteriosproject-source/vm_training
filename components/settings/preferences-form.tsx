"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
export function PreferencesForm({
  userId,
  preferences,
  equipment,
  selected,
}: {
  userId: string;
  preferences: {
    sessions_per_week: number;
    session_minutes: number;
    cardio_preference: number;
  };
  equipment: { id: string; name: string }[];
  selected: string[];
}) {
  const router = useRouter();
  const [days, setDays] = useState(preferences.sessions_per_week);
  const [minutes, setMinutes] = useState(preferences.session_minutes);
  const [cardio, setCardio] = useState(preferences.cardio_preference);
  const [items, setItems] = useState(selected);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("training_preferences")
      .update({
        sessions_per_week: days,
        session_minutes: minutes,
        cardio_preference: cardio,
      })
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    await supabase.from("user_equipment").delete().eq("user_id", userId);
    if (items.length) {
      const { error: eqError } = await supabase
        .from("user_equipment")
        .insert(
          items.map((equipment_id) => ({ user_id: userId, equipment_id })),
        );
      if (eqError) {
        toast.error(eqError.message);
        setBusy(false);
        return;
      }
    }
    toast.success("Preferências atualizadas");
    setBusy(false);
    router.refresh();
  }
  async function regenerate() {
    await save();
    setBusy(true);
    const response = await fetch("/api/plans/generate", { method: "POST" });
    const body = (await response.json()) as {
      error?: string;
      status?: "draft" | "active";
    };
    if (response.ok)
      toast.success(
        body.status === "active"
          ? "Novo plano ativado; o anterior foi arquivado"
          : "Novo rascunho criado; aguardando aprovação dos vídeos",
      );
    else toast.error(body.error ?? "Não foi possível gerar");
    setBusy(false);
    router.push("/workouts");
    router.refresh();
  }
  return (
    <div className="space-y-7">
      <Group
        label="Treinos por semana"
        values={[2, 3, 4, 5]}
        value={days}
        onChange={setDays}
      />
      <Group
        label="Minutos por treino"
        values={[30, 45, 60, 75, 90]}
        value={minutes}
        onChange={setMinutes}
      />
      <label className="block text-sm font-medium">
        Preferência por cardio: {cardio}/5
        <input
          className="mt-4 w-full accent-[var(--accent)]"
          type="range"
          min="1"
          max="5"
          value={cardio}
          onChange={(e) => setCardio(+e.target.value)}
        />
      </label>
      <div>
        <h2 className="text-sm font-medium">Equipamentos disponíveis</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {equipment.map((item) => (
            <button
              key={item.id}
              onClick={() =>
                setItems((current) =>
                  current.includes(item.id)
                    ? current.filter((id) => id !== item.id)
                    : [...current, item.id],
                )
              }
              className={`min-h-12 rounded-xl border px-2 text-sm ${items.includes(item.id) ? "border-accent bg-accent/10" : ""}`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="secondary" onClick={save} disabled={busy}>
          Manter treino atual
        </Button>
        <Button onClick={regenerate} disabled={busy}>
          Salvar e gerar novo plano
        </Button>
      </div>
    </div>
  );
}
function Group({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: number[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <h2 className="text-sm font-medium">{label}</h2>
      <div className="mt-3 flex gap-2">
        {values.map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`min-h-12 flex-1 rounded-xl border text-sm ${value === v ? "border-accent bg-accent text-accent-foreground" : ""}`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
