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
