"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
export function ProfileForm({
  profile,
}: {
  profile: {
    user_id: string;
    display_name: string | null;
    birth_date: string | null;
    height_cm: number | null;
  };
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(data: FormData) {
    setBusy(true);
    const { error } = await createClient()
      .from("profiles")
      .update({
        display_name: String(data.get("name")),
        birth_date: String(data.get("birthDate")),
        height_cm: +String(data.get("height")),
      })
      .eq("user_id", profile.user_id);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado");
    setBusy(false);
    router.refresh();
  }
  return (
    <form action={submit} className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2 text-sm">
        Nome
        <Input
          className="mt-2"
          name="name"
          defaultValue={profile.display_name ?? ""}
          required
        />
      </label>
      <label className="text-sm">
        Data de nascimento
        <Input
          className="mt-2"
          name="birthDate"
          type="date"
          defaultValue={profile.birth_date ?? ""}
          required
        />
      </label>
      <label className="text-sm">
        Altura (cm)
        <Input
          className="mt-2"
          name="height"
          type="number"
          defaultValue={profile.height_cm ?? ""}
          required
        />
      </label>
      <Button className="sm:col-span-2" disabled={busy}>
        {busy ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
