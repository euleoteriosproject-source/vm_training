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

export type GymProfile =
  | "STANDARD_COMMERCIAL_GYM"
  | "BASIC_GYM"
  | "HOME_GYM"
  | "BODYWEIGHT_ONLY";

export type ExerciseCandidate = {
  id: string;
  name: string;
  pattern: string;
  category: "strength" | "cardio" | "mobility";
  equipment: string[];
  capabilities?: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  active: boolean;
  hasApprovedMedia: boolean;
  mediaReady?: boolean;
  autoPlanEligible?: boolean;
  eligibilityReasons?: string[];
};

export type PlanInput = {
  goals: { code: GoalCode; priority: number }[];
  sessionsPerWeek: 2 | 3 | 4 | 5;
  sessionMinutes: 30 | 45 | 60 | 75 | 90;
  cardioPreference: 1 | 2 | 3 | 4 | 5;
  experience: "beginner" | "returning" | "intermediate" | "advanced";
  equipment: string[];
  unavailableEquipment?: string[];
  gymProfile?: GymProfile;
  capabilities?: string[];
  preferences?: Record<string, "like" | "neutral" | "dislike" | "avoid">;
  movementAttentionPatterns?: string[];
  recentExerciseIds?: string[];
  generatorVersion?: string;
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

export type PlanQualityMetrics = {
  totalSlots: number;
  uniqueExercises: number;
  uniquenessPercent: number;
  maxExactExerciseFrequency: number;
  exactExerciseOnAllDays: string[];
  dayPairOverlapPercent: Record<string, number>;
  movementPatternCount: number;
  movementPatternDistribution: Record<string, number>;
  mediaCoveragePercent: number;
  invalidEquipment: string[];
  ineligibleExercises: string[];
  goalAlignment: {
    status: "PASS" | "FAIL";
    goal: GoalCode;
    strengthSlots: number;
    cardioSlots: number;
    mobilityOrPostureSlots: number;
    lowerRepStrengthSlots: number;
    moderateRepStrengthSlots: number;
    longRestStrengthSlots: number;
    reasons: string[];
  };
};

export type PlanConstraintDiagnostic = {
  code:
    | "INSUFFICIENT_ELIGIBLE_POOL"
    | "INSUFFICIENT_UNIQUE_EXERCISES"
    | "EXCESSIVE_DAY_OVERLAP"
    | "EXERCISE_ON_ALL_DAYS"
    | "INCOMPLETE_MEDIA_COVERAGE"
    | "INVALID_EQUIPMENT"
    | "INELIGIBLE_EXERCISE"
    | "INSUFFICIENT_MOVEMENT_COVERAGE"
    | "GOAL_MISALIGNED";
  message: string;
  actual: number | string[];
  required: number | string;
};

export type GeneratedPlan = {
  days: GeneratedDay[];
  quality: PlanQualityMetrics;
  generatorVersion: string;
};
