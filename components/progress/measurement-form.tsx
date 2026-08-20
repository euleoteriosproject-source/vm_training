"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
export function MeasurementForm() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(data: FormData) {
    setBusy(true);
    const {
      data: { user },
    } = await createClient().auth.getUser();
    if (!user) return;
    const payload = {
      user_id: user.id,
      measured_at: new Date().toISOString(),
      weight_kg: +String(data.get("weight")),
      waist_cm: data.get("waist") ? +String(data.get("waist")) : null,
      hips_cm: data.get("hips") ? +String(data.get("hips")) : null,
      clothing_fit: data.get("clothing") || null,
      notes: String(data.get("notes") || "") || null,
    };
    const { error } = await createClient()
      .from("body_measurements")
      .insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Peso atualizado");
      setOpen(false);
      router.refresh();
    }
    setBusy(false);
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>Registrar medida</Button>
      <Sheet title="Nova medição" open={open} onOpenChange={setOpen}>
        <form action={submit} className="space-y-4">
          <label className="block text-sm">
            Peso (kg)
            <Input
              className="mt-2"
              name="weight"
              type="number"
              step="0.1"
              inputMode="decimal"
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Cintura (cm)
              <Input className="mt-2" name="waist" type="number" step="0.1" />
            </label>
            <label className="text-sm">
              Quadril (cm)
              <Input className="mt-2" name="hips" type="number" step="0.1" />
            </label>
          </div>
          <label className="block text-sm">
            Como as roupas estão vestindo?
            <select
              name="clothing"
              className="mt-2 h-12 w-full rounded-xl border bg-surface px-3"
            >
              <option value="">Não informar</option>
              <option value="tighter">Mais apertadas</option>
              <option value="same">Igual</option>
              <option value="looser">Um pouco mais folgadas</option>
              <option value="much_looser">Bem mais folgadas</option>
            </select>
          </label>
          <label className="block text-sm">
            Anotações
            <textarea
              name="notes"
              className="mt-2 min-h-24 w-full rounded-xl border bg-surface p-3"
            />
          </label>
          <Button className="w-full" disabled={busy}>
            {busy ? "Salvando…" : "Salvar medição"}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
