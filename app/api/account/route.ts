import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
export async function DELETE(request: Request) {
  const parsed = z
    .object({ password: z.string().min(8) })
    .safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Senha inválida" }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.password,
  });
  if (reauthError)
    return NextResponse.json({ error: "Senha incorreta" }, { status: 403 });
  const { error } = await supabase.rpc("delete_own_account_data");
  if (error)
    return NextResponse.json(
      { error: "Não foi possível excluir a conta" },
      { status: 500 },
    );
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.json({ ok: true });
}
