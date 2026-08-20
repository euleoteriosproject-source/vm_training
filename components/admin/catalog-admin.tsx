"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
export function CatalogAdmin({
  equipment,
  emails,
}: {
  equipment: { id: string; slug: string; name: string; active: boolean }[];
  emails: {
    id: string;
    email: string;
    display_name: string | null;
    default_role: string;
    active: boolean;
  }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function addEquipment(data: FormData) {
    setBusy(true);
    const { error } = await createClient()
      .from("equipment")
      .insert({
        name: String(data.get("name")),
        slug: String(data.get("slug")),
      });
    if (error) toast.error(error.message);
    else toast.success("Equipamento criado");
    setBusy(false);
    router.refresh();
  }
  async function addEmail(data: FormData) {
    setBusy(true);
    const { error } = await createClient()
      .from("allowed_signup_emails")
      .insert({
        email: String(data.get("email")).toLowerCase(),
        display_name: String(data.get("name")),
        default_role: String(data.get("role")),
      });
    if (error) toast.error(error.message);
    else toast.success("Convite adicionado");
    setBusy(false);
    router.refresh();
  }
  async function toggle(table: string, id: string, active: boolean) {
    const { error } = await createClient()
      .from(table)
      .update({ active: !active })
      .eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Status atualizado");
    router.refresh();
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border bg-surface p-5">
        <h2 className="text-lg font-semibold">Equipamentos</h2>
        <form action={addEquipment} className="mt-4 grid grid-cols-2 gap-2">
          <Input name="name" placeholder="Nome" required />
          <Input name="slug" placeholder="slug" required />
          <Button className="col-span-2" disabled={busy}>
            Adicionar
          </Button>
        </form>
        <div className="mt-5 divide-y">
          {equipment.map((item) => (
            <div
              key={item.id}
              className="flex min-h-12 items-center justify-between"
            >
              <span className={item.active ? "" : "line-through text-muted"}>
                {item.name}
              </span>
              <Button
                variant="ghost"
                onClick={() => toggle("equipment", item.id, item.active)}
              >
                {item.active ? "Desativar" : "Ativar"}
              </Button>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border bg-surface p-5">
        <h2 className="text-lg font-semibold">E-mails autorizados</h2>
        <form action={addEmail} className="mt-4 space-y-2">
          <Input name="email" type="email" placeholder="E-mail" required />
          <Input name="name" placeholder="Nome" required />
          <select
            name="role"
            className="h-12 w-full rounded-xl border bg-surface px-3"
          >
            <option value="member">Membro</option>
            <option value="admin">Admin</option>
          </select>
          <Button className="w-full" disabled={busy}>
            Adicionar
          </Button>
        </form>
        <div className="mt-5 divide-y">
          {emails.map((item) => (
            <div
              key={item.id}
              className="flex min-h-16 items-center justify-between gap-3"
            >
              <div>
                <p
                  className={
                    item.active ? "text-sm" : "text-sm line-through text-muted"
                  }
                >
                  {item.email}
                </p>
                <p className="text-xs text-muted">
                  {item.display_name} · {item.default_role}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() =>
                  toggle("allowed_signup_emails", item.id, item.active)
                }
              >
                {item.active ? "Desativar" : "Ativar"}
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
