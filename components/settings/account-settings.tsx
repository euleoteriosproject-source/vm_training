"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, Monitor, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
export function AccountSettings() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  async function updatePassword(data: FormData) {
    const value = String(data.get("password"));
    if (value.length < 8) {
      toast.error("Use ao menos 8 caracteres");
      return;
    }
    const { error } = await createClient().auth.updateUser({ password: value });
    if (error) toast.error(error.message);
    else toast.success("Senha atualizada");
  }
  async function remove() {
    setBusy(true);
    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error(body.error ?? "Não foi possível excluir");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }
  const themes = [
    ["dark", "Escuro", Moon],
    ["light", "Claro", Sun],
    ["system", "Sistema", Monitor],
  ] as const;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-surface p-5">
        <h2 className="font-semibold">Aparência</h2>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {themes.map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border text-sm ${theme === value ? "border-accent bg-accent/10" : ""}`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border bg-surface p-5">
        <h2 className="font-semibold">Alterar senha</h2>
        <form
          action={updatePassword}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Nova senha"
            required
          />
          <Button>Atualizar</Button>
        </form>
      </section>
      <section className="rounded-2xl border bg-surface p-5">
        <h2 className="font-semibold">Sessão</h2>
        <Button variant="secondary" className="mt-4" onClick={logout}>
          Sair
        </Button>
      </section>
      <section className="rounded-2xl border border-danger/30 bg-surface p-5">
        <h2 className="font-semibold text-danger">Excluir conta</h2>
        <p className="mt-2 text-sm text-muted">
          Remove permanentemente sua conta e todos os dados associados.
        </p>
        <Button
          variant="danger"
          className="mt-4"
          onClick={() => setDeleteOpen(true)}
        >
          Excluir minha conta
        </Button>
      </section>
      <Sheet
        title="Confirmar exclusão"
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      >
        <p className="text-sm leading-6 text-muted">
          Esta ação não pode ser desfeita. Informe sua senha para confirmar.
        </p>
        <Input
          className="mt-5"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha atual"
        />
        <Button
          variant="danger"
          className="mt-4 w-full"
          disabled={busy || password.length < 8}
          onClick={remove}
        >
          {busy ? "Excluindo…" : "Excluir permanentemente"}
        </Button>
      </Sheet>
    </div>
  );
}
