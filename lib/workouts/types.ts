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

export type WorkoutStyle = "gym_first" | "mixed" | "free_weight";

export type ExerciseEnvironmentProfile =
  | "commercial_machine"
  | "commercial_cable"
  | "commercial_free_weight"
  | "bodyweight_floor"
  | "bodyweight_station"
  | "cardio_machine"
  | "specialized_space";

export type TechnicalComplexity = "low" | "moderate" | "high";

export type TrainingRole =
  | "PRIMARY_LOWER"
  | "PRIMARY_PUSH"
  | "PRIMARY_PULL"
  | "SECONDARY_LOWER"
  | "SECONDARY_PUSH"
  | "SECONDARY_PULL"
  | "ACCESSORY"
  | "ISOLATION"
  | "CORE"
  | "CONDITIONING"
  | "MOBILITY"
  | "CORRECTIVE";

export type FatigueProfile = "low" | "medium" | "high";
export type StabilityProfile = "high" | "moderate" | "low";
export type ProgrammingPriority = "high" | "medium" | "low";
export type NeedCoverageStatus = "UNMET" | "PARTIALLY_COVERED" | "COVERED";
export type SlotRequirement = "REQUIRED" | "OPTIONAL";
export type ProgrammingNeedCode =
  | "PRIMARY_LOWER_STIMULUS"
  | "HORIZONTAL_PUSH"
  | "VERTICAL_PUSH"
  | "HORIZONTAL_PULL"
  | "VERTICAL_PULL"
  | "POSTERIOR_CHAIN"
  | "KNEE_DOMINANT"
  | "SUPPORTING_VOLUME"
  | "TRUNK_STABILITY"
  | "SCAPULAR_CONTROL"
  | "CONDITIONING"
  | "MOBILITY";
export type ProgressionState =
  | "PROGRESS"
  | "MAINTAIN"
  | "REGRESS"
  | "INSUFFICIENT_DATA";

export type NormalizedTrainingProfile = {
  primaryGoal: GoalCode;
  secondaryGoals: GoalCode[];
  sessionsPerWeek: 2 | 3 | 4 | 5;
  sessionMinutes: 30 | 45 | 60 | 75 | 90;
  cardioPreference: 1 | 2 | 3 | 4 | 5;
  experience: PlanInput["experience"];
  gymProfile: GymProfile;
  workoutStyle: WorkoutStyle;
};

export type GoalStrategy = {
  goal: GoalCode;
  label: string;
  strengthShare: number;
  conditioningSlotsPerWeek: number;
  mobilitySlotsPerWeek: number;
  preferredRepRange: [number, number];
  primarySets: number;
  secondarySets: number;
  accessorySets: number;
  restSeconds: { primary: number; secondary: number; accessory: number };
  patternPriorities: string[];
};

export type TrainingArchitectureDay = {
  name: string;
  focus: string;
  patternBias: string[];
};

export type TrainingArchitecture = {
  id: string;
  rationale: string;
  days: TrainingArchitectureDay[];
};

export type TrainingSlot = {
  id: string;
  dayIndex: number;
  position: number;
  role: TrainingRole;
  patterns: string[];
  targetMuscles: string[];
  priority: ProgrammingPriority;
  fatigueBudget: FatigueProfile;
  maxTechnicalComplexity: TechnicalComplexity;
  rationale: string;
  need: ProgrammingNeedCode;
  needStatus: NeedCoverageStatus;
  requirement: SlotRequirement;
  programmingValue: number;
  minimumProgrammingValue: number;
  estimatedTimeMinutes: number;
  redundancy: number;
  justification: string;
};

export type ProgrammingNeed = {
  code: ProgrammingNeedCode;
  role: TrainingRole;
  patterns: string[];
  targetMuscles: string[];
  targetWeeklyExposure: number;
  goalRelevant: boolean;
  corrective: boolean;
  rationale: string;
};

export type PerformanceRecord = {
  exerciseId: string;
  completedAt: string;
  prescribedSets: number;
  completedSets: number;
  prescribedRepMin: number;
  prescribedRepMax: number;
  actualReps: number[];
  loadKg: number[];
  rpe?: number;
};

export type ProgressionRecommendation = {
  state: ProgressionState;
  reason: string;
  loadChangePercent: number;
};

export type ExerciseCandidate = {
  id: string;
  name: string;
  pattern: string;
  trainingRole?: string;
  category: "strength" | "cardio" | "mobility";
  equipment: string[];
  capabilities?: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  active: boolean;
  hasApprovedMedia: boolean;
  mediaReady?: boolean;
  autoPlanEligible?: boolean;
  eligibilityReasons?: string[];
  environmentProfile?: ExerciseEnvironmentProfile;
  gymEquipmentTier?: 1 | 2 | 3 | 4;
  technicalComplexity?: TechnicalComplexity;
  goalSuitability?: GoalCode[];
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  exerciseFamily?: string;
  fatigueProfile?: FatigueProfile;
  stabilityProfile?: StabilityProfile;
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
  workoutStyle?: WorkoutStyle;
  capabilities?: string[];
  preferences?: Record<string, "like" | "neutral" | "dislike" | "avoid">;
  movementAttentionPatterns?: string[];
  recentExerciseIds?: string[];
  performanceHistory?: PerformanceRecord[];
  catalogVersion?: string;
  generatorVersion?: string;
};

export type GeneratedDay = {
  name: string;
  focus?: string;
  rationale?: string;
  estimatedMinutes: number;
  exercises: {
    exerciseId: string;
    sets: number;
    repMin: number;
    repMax: number;
    restSeconds: number;
    targetDurationSeconds?: number;
    slotRole?: TrainingRole;
    exerciseFamily?: string;
    rationale?: string;
    progression?: ProgressionRecommendation;
    programmingNeed?: ProgrammingNeedCode;
    needStatus?: NeedCoverageStatus;
    programmingValue?: number;
    redundancy?: number;
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
  gymEquipmentSlots: number;
  machineCableSlots: number;
  freeWeightSlots: number;
  unsupportedFreeWeightSlots: number;
  bodyweightFloorSlots: number;
  specializedSlots: number;
  gymEquipmentPercent: number;
  bodyweightPercent: number;
  corePostureSlots: number;
  bodyweightFloorSlotsByDay: number[];
  gymFirstExceptions: {
    exerciseId: string;
    day: string;
    rationale:
      | "explicit_user_preference"
      | "programming_balance"
      | "no_media_ready_gym_alternative";
  }[];
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
  exerciseFamilyFrequency?: Record<string, number>;
  muscleFrequency?: Record<string, number>;
  roleDistribution?: Partial<Record<TrainingRole, number>>;
  weeklyVolumeSets?: Record<string, number>;
  volumeValidationStatus?: "PASS" | "FAIL";
  frequencyValidationStatus?: "PASS" | "FAIL";
  functionalRepetitionStatus?: "PASS" | "FAIL";
  functionalCoverageStatus?: "PASS" | "FAIL";
  slotJustificationStatus?: "PASS" | "FAIL";
  sessionEfficiencyStatus?: "PASS" | "FAIL";
  fillerSlots?: number;
  unjustifiedCorrectiveSlots?: number;
  optionalSlotsPruned?: number;
  estimatedSessionMinutesByDay?: number[];
  averageProgrammingValue?: number;
  environmentContextFitStatus?: "PASS" | "FAIL";
  weeklyBalanceStatus?: "PASS" | "FAIL";
  orderingStatus?: "PASS" | "FAIL";
  programQualityStatus?: "PASS" | "FAIL";
  determinismKey?: string;
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
    | "GOAL_MISALIGNED"
    | "GYM_FIRST_CONSTRAINT"
    | "WEEKLY_BALANCE"
    | "VOLUME_INVALID"
    | "FREQUENCY_INVALID"
    | "FUNCTIONAL_REPETITION_INVALID"
    | "FUNCTIONAL_COVERAGE_INVALID"
    | "SLOT_JUSTIFICATION_INVALID"
    | "SESSION_EFFICIENCY_INVALID"
    | "ORDERING_INVALID"
    | "SLOT_UNFILLED";
  message: string;
  actual: number | string[] | Record<string, number | number[] | string[]>;
  required: number | string;
};

export type GeneratedPlan = {
  days: GeneratedDay[];
  quality: PlanQualityMetrics;
  generatorVersion: string;
  architecture?: TrainingArchitecture;
  slots?: TrainingSlot[];
  prunedSlots?: TrainingSlot[];
};
