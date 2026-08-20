"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
export function StartButton({
  dayId,
  className,
}: {
  dayId: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function start() {
    setBusy(true);
    const { data, error } = await createClient().rpc("start_workout", {
      p_workout_day_id: dayId,
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    router.push(`/workout-session/${data}`);
  }
  return (
    <Button size="lg" className={className} disabled={busy} onClick={start}>
      <Play size={18} fill="currentColor" />
      {busy ? "Preparando…" : "Iniciar treino"}
    </Button>
  );
}
