export type GoalCode =
  | "weight_loss"
  | "fat_loss"
  | "measurements"
  | "muscle_gain"
  | "strength"
  | "posture"
  | "mobility"
  | "conditioning"
  | "cardio_endurance"
  | "general_health";

export type ExerciseCandidate = {
  id: string;
  name: string;
  pattern: string;
  category: "strength" | "cardio" | "mobility";
  equipment: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  active: boolean;
  hasApprovedMedia: boolean;
};

export type PlanInput = {
  goals: { code: GoalCode; priority: number }[];
  sessionsPerWeek: 2 | 3 | 4 | 5;
  sessionMinutes: 30 | 45 | 60 | 75 | 90;
  cardioPreference: 1 | 2 | 3 | 4 | 5;
  experience: "beginner" | "returning" | "intermediate" | "advanced";
  equipment: string[];
  preferences?: Record<string, "like" | "neutral" | "dislike" | "avoid">;
};

export type GeneratedDay = {
  name: string;
  estimatedMinutes: number;
  exercises: {
    exerciseId: string;
    sets: number;
    repMin: number;
    repMax: number;
    restSeconds: number;
    targetDurationSeconds?: number;
  }[];
};
