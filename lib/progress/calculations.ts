export type SessionSummary = {
  completedAt: string;
  durationSeconds: number;
  completedSets: number;
  totalVolumeKg: number;
};

export function weeklyFrequency(
  sessions: Pick<SessionSummary, "completedAt">[],
  now = new Date(),
) {
  const start = new Date(now);
  const weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  start.setHours(0, 0, 0, 0);
  return sessions.filter(
    (session) =>
      new Date(session.completedAt) >= start &&
      new Date(session.completedAt) <= now,
  ).length;
}

export function progressChange(values: number[]) {
  if (values.length < 2 || values[0] === 0) return null;
  return ((values.at(-1)! - values[0]) / values[0]) * 100;
}

export function bodyMassIndex(weightKg: number, heightCm: number) {
  if (weightKg <= 0 || heightCm <= 0) return null;
  return weightKg / (heightCm / 100) ** 2;
}

export function ageInYears(birthDate: string, now = new Date()) {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || birth > now) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() &&
      now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function weightTrend(current: number, previous?: number | null) {
  if (previous == null) return "Primeiro registro";
  const delta = current - previous;
  if (Math.abs(delta) < 0.05) return "Peso estável";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1).replace(".", ",")} kg`;
}

export function transformHistory(
  rows: {
    completed_at: string;
    duration_seconds: number | null;
    set_logs?: {
      completed: boolean;
      weight_kg: number | null;
      reps: number | null;
    }[];
  }[],
): SessionSummary[] {
  return rows.map((row) => ({
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds ?? 0,
    completedSets: row.set_logs?.filter((set) => set.completed).length ?? 0,
    totalVolumeKg:
      row.set_logs?.reduce(
        (sum, set) =>
          sum + (set.completed ? (set.weight_kg ?? 0) * (set.reps ?? 0) : 0),
        0,
      ) ?? 0,
  }));
}
