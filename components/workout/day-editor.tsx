"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
type Item = {
  id: string;
  exercise_id: string;
  position: number;
  target_sets: number;
  rep_min: number | null;
  rep_max: number | null;
  rest_seconds: number;
};
export function DayEditor({
  dayId,
  initial,
  catalog,
}: {
  dayId: string;
  initial: Item[];
  catalog: { id: string; name_pt: string }[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  function update(id: string, patch: Partial<Item>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }
  async function save() {
    setBusy(true);
    const supabase = createClient();
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const { error } = await supabase
        .from("workout_day_exercises")
        .update({
          exercise_id: item.exercise_id,
          position: index + 1,
          target_sets: item.target_sets,
          rep_min: item.rep_min,
          rep_max: item.rep_max,
          rest_seconds: item.rest_seconds,
        })
        .eq("id", item.id);
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
    }
    toast.success("Treino atualizado");
    setBusy(false);
    router.push(`/workouts/${dayId}`);
    router.refresh();
  }
  async function remove(item: Item) {
    const { error } = await createClient()
      .from("workout_day_exercises")
      .delete()
      .eq("id", item.id);
    if (error) toast.error(error.message);
    else {
      setItems((current) => current.filter((row) => row.id !== item.id));
      toast.success("Exercício removido");
    }
  }
  async function add() {
    const available = catalog.find(
      (ex) => !items.some((item) => item.exercise_id === ex.id),
    );
    if (!available) {
      toast.info("Não há outro exercício ativo disponível");
      return;
    }
    const { data, error } = await createClient()
      .from("workout_day_exercises")
      .insert({
        workout_day_id: dayId,
        exercise_id: available.id,
        position: items.length + 1,
        target_sets: 3,
        rep_min: 8,
        rep_max: 12,
        rest_seconds: 75,
      })
      .select(
        "id,exercise_id,position,target_sets,rep_min,rep_max,rest_seconds",
      )
      .single();
    if (error) toast.error(error.message);
    else setItems((current) => [...current, data]);
  }
  return (
    <div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-2xl border bg-surface p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">{index + 1}</span>
              <select
                value={item.exercise_id}
                onChange={(e) =>
                  update(item.id, { exercise_id: e.target.value })
                }
                className="h-11 min-w-0 flex-1 rounded-xl border bg-surface px-3 text-sm"
              >
                {catalog.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name_pt}
                  </option>
                ))}
              </select>
              <Button
                variant="danger"
                size="icon"
                onClick={() => remove(item)}
                aria-label="Remover"
              >
                <Trash2 size={17} />
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <Label text="Séries">
                <Input
                  type="number"
                  value={item.target_sets}
                  onChange={(e) =>
                    update(item.id, { target_sets: +e.target.value })
                  }
                />
              </Label>
              <Label text="Rep mín">
                <Input
                  type="number"
                  value={item.rep_min ?? ""}
                  onChange={(e) =>
                    update(item.id, { rep_min: +e.target.value })
                  }
                />
              </Label>
              <Label text="Rep máx">
                <Input
                  type="number"
                  value={item.rep_max ?? ""}
                  onChange={(e) =>
                    update(item.id, { rep_max: +e.target.value })
                  }
                />
              </Label>
              <Label text="Descanso">
                <Input
                  type="number"
                  value={item.rest_seconds}
                  onChange={(e) =>
                    update(item.id, { rest_seconds: +e.target.value })
                  }
                />
              </Label>
            </div>
          </div>
        ))}
      </div>
      <Button variant="secondary" className="mt-4 w-full" onClick={add}>
        <Plus size={17} />
        Adicionar exercício
      </Button>
      <Button className="mt-3 w-full" disabled={busy} onClick={save}>
        {busy ? "Salvando…" : "Salvar treino"}
      </Button>
    </div>
  );
}
function Label({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs text-muted">
      {text}
      <div className="mt-1">{children}</div>
    </label>
  );
}
