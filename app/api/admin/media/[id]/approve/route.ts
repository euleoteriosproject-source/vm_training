import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Aprovação direta desativada. Revise, processe e publique a mídia nas etapas operacionais.",
    },
    { status: 409 },
  );
}
