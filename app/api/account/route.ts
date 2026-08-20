import { createClient as createAdminClient } from "@supabase/supabase-js";
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    return NextResponse.json(
      { error: "Operação administrativa não configurada" },
      { status: 503 },
    );
  const admin = createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error)
    return NextResponse.json(
      { error: "Não foi possível excluir a conta" },
      { status: 500 },
    );
  return NextResponse.json({ ok: true });
}
