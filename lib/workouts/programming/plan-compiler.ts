import type {
  ExerciseCandidate,
  GeneratedDay,
  GoalStrategy,
  NormalizedTrainingProfile,
  PlanInput,
  TrainingArchitecture,
  TrainingRole,
  TrainingSlot,
} from "../types";
import { recommendProgression } from "./progression.ts";

type RankedCandidate = { exercise: ExerciseCandidate; score: number };
type State = { picks: ExerciseCandidate[]; score: number; usage: Map<string, number>; familyUsage: Map<string, number> };

const complexityRank = { low: 0, moderate: 1, high: 2 } as const;

export function compilePlan(
  input: PlanInput,
  profile: NormalizedTrainingProfile,
  strategy: GoalStrategy,
  architecture: TrainingArchitecture,
  slots: TrainingSlot[],
  eligible: RankedCandidate[],
): GeneratedDay[] {
  if (!eligible.length) throw new Error("Não há exercícios elegíveis para preencher o plano.");
  let beam: State[] = [{ picks: [], score: 0, usage: new Map(), familyUsage: new Map() }];

  for (const slot of slots) {
    const matching = eligible.filter(({ exercise }) => matchesSlot(exercise, slot));
    if (!matching.length) throw new Error(`Não há candidato funcionalmente válido para o slot ${slot.id}.`);
    const poolExercises = matching.map(({ exercise }) => exercise);
    const pool = [...matching]
      .sort((left, right) => rankForSlot(right, slot, profile, input, poolExercises) - rankForSlot(left, slot, profile, input, poolExercises) || left.exercise.id.localeCompare(right.exercise.id))
      // Keep enough semantically compatible alternatives available for later
      // days. A very small local pool can exhaust every candidate at the
      // two-use ceiling even when the full eligible catalog has safe options.
      .slice(0, Math.min(16, eligible.length));
    const next: State[] = [];
    for (const state of beam) {
      for (const ranked of pool) {
        const family = exerciseFamily(ranked.exercise);
        const exactCount = state.usage.get(ranked.exercise.id) ?? 0;
        const familyCount = state.familyUsage.get(family) ?? 0;
        const sameDay = selectedForDay(state.picks, slots, slot.dayIndex);
        if (sameDay.some((exercise) => exercise.id === ranked.exercise.id)) continue;
        const sameFamilyInDay = sameDay.some((exercise) => exerciseFamily(exercise) === family);
        if (wouldExceedDayOverlap(state.picks, slot, slots, ranked.exercise.id)) continue;
        if (exactCount >= 2 && eligible.length >= slots.length / 2) continue;
        const canReuseCompatible = pool.some(({ exercise }) =>
          (state.usage.get(exercise.id) ?? 0) === 1 &&
          !sameDay.some((dayExercise) => dayExercise.id === exercise.id),
        );
        if (state.usage.size >= 15 && exactCount === 0 && canReuseCompatible) continue;
        const usage = new Map(state.usage);
        const familyUsage = new Map(state.familyUsage);
        usage.set(ranked.exercise.id, exactCount + 1);
        familyUsage.set(family, familyCount + 1);
        next.push({
          picks: [...state.picks, ranked.exercise],
          score:
            state.score +
            rankForSlot(ranked, slot, profile, input, poolExercises) -
            exactCount * 28 -
            (state.usage.size >= 15 && exactCount === 0 ? 140 : 0) -
            familyCount * 9 -
            (sameFamilyInDay ? 48 : 0) -
            weeklyImbalancePenalty([...state.picks, ranked.exercise]),
          usage,
          familyUsage,
        });
      }
    }
    beam = next
      .sort((left, right) => right.score - left.score || signature(left.picks).localeCompare(signature(right.picks)))
      .slice(0, 100);
    if (!beam.length) throw new Error(`Não foi possível preencher o slot ${slot.id}.`);
  }

  const winner = beam[0];
  const uniqueFloor = Math.min(eligible.length, Math.ceil(slots.length * 2 / 3));
  const diversifiedPicks = enforceUniqueFloor(winner.picks, slots, eligible, uniqueFloor);
  const uniqueCap = slots.length === 18 ? 15 : slots.length;
  const finalPicks = enforceUniqueCap(diversifiedPicks, slots, eligible, uniqueCap);
  return architecture.days.map((day, dayIndex) => {
    const daySlots = slots.filter((slot) => slot.dayIndex === dayIndex);
    return {
      name: day.name,
      focus: day.focus,
      rationale: architecture.rationale,
      estimatedMinutes: daySlots.reduce((sum, slot) => sum + slot.estimatedTimeMinutes, 0),
      exercises: daySlots.map((slot) => {
        const exercise = finalPicks[slots.indexOf(slot)];
        const prescription = prescriptionFor(exercise, slot.role, strategy, profile.sessionMinutes);
        return {
          exerciseId: exercise.id,
          ...prescription,
          slotRole: slot.role,
          exerciseFamily: exerciseFamily(exercise),
          rationale: explainChoice(exercise, slot, strategy),
          progression: recommendProgression(exercise.id, input.performanceHistory),
          programmingNeed: slot.need,
          needStatus: slot.needStatus,
          programmingValue: slot.programmingValue,
          redundancy: slot.redundancy,
        };
      }),
    } satisfies GeneratedDay;
  });
}

function enforceUniqueFloor(
  picks: ExerciseCandidate[],
  slots: TrainingSlot[],
  eligible: RankedCandidate[],
  minimum: number,
) {
  const result = [...picks];
  while (new Set(result.map((exercise) => exercise.id)).size < minimum) {
    const usage = new Map(result.map((exercise) => [
      exercise.id,
      result.filter((item) => item.id === exercise.id).length,
    ]));
    const used = new Set(result.map((exercise) => exercise.id));
    let replaced = false;
    for (let index = result.length - 1; index >= 0 && !replaced; index--) {
      if ((usage.get(result[index].id) ?? 0) < 2) continue;
      const alternative = eligible.find(({ exercise }) =>
        !used.has(exercise.id) &&
        exercise.pattern === result[index].pattern &&
        matchesSlot(exercise, slots[index]) &&
        replacementKeepsOverlap(result, slots, index, exercise.id),
      )?.exercise;
      if (!alternative) continue;
      result[index] = alternative;
      replaced = true;
    }
    if (!replaced) break;
  }
  return result;
}

function replacementKeepsOverlap(
  picks: ExerciseCandidate[],
  slots: TrainingSlot[],
  replacementIndex: number,
  replacementId: string,
) {
  const candidate = picks.map((exercise, index) =>
    index === replacementIndex ? { ...exercise, id: replacementId } : exercise,
  );
  const targetDay = slots[replacementIndex].dayIndex;
  const targetDayIds = new Set(selectedForDay(candidate, slots, targetDay).map((exercise) => exercise.id));
  const targetSize = slots.filter((slot) => slot.dayIndex === targetDay).length;
  if (targetDayIds.size < targetSize) return false;
  for (const dayIndex of [...new Set(slots.map((slot) => slot.dayIndex))]) {
    if (dayIndex === targetDay) continue;
    const otherIds = new Set(selectedForDay(candidate, slots, dayIndex).map((exercise) => exercise.id));
    const allowed = Math.floor(Math.min(targetSize, slots.filter((slot) => slot.dayIndex === dayIndex).length) / 2);
    if ([...targetDayIds].filter((id) => otherIds.has(id)).length > allowed) return false;
  }
  return true;
}

function wouldExceedDayOverlap(
  picks: ExerciseCandidate[],
  slot: TrainingSlot,
  slots: TrainingSlot[],
  candidateId: string,
) {
  if (slot.dayIndex === 0) return false;
  const currentIds = new Set(selectedForDay(picks, slots, slot.dayIndex).map((exercise) => exercise.id));
  currentIds.add(candidateId);
  for (let prior = 0; prior < slot.dayIndex; prior++) {
    const priorIds = new Set(selectedForDay(picks, slots, prior).map((exercise) => exercise.id));
    const allowed = Math.floor(Math.min(
      slots.filter((item) => item.dayIndex === slot.dayIndex).length,
      slots.filter((item) => item.dayIndex === prior).length,
    ) / 2);
    if ([...currentIds].filter((id) => priorIds.has(id)).length > allowed) return true;
  }
  return false;
}

function enforceUniqueCap(
  picks: ExerciseCandidate[],
  slots: TrainingSlot[],
  eligible: RankedCandidate[],
  maximum: number,
) {
  const result = [...picks];
  const counts = () => new Map(result.map((exercise) => [exercise.id, result.filter((item) => item.id === exercise.id).length]));
  while (new Set(result.map((exercise) => exercise.id)).size > maximum) {
    const usage = counts();
    let replaced = false;
    for (let index = result.length - 1; index >= 0 && !replaced; index--) {
      if ((usage.get(result[index].id) ?? 0) !== 1) continue;
      const slot = slots[index];
      const dayIds = new Set(selectedForDay(result, slots, slot.dayIndex).map((exercise) => exercise.id));
      const alternative = eligible.find(({ exercise }) =>
        matchesSlot(exercise, slot) &&
        (usage.get(exercise.id) ?? 0) === 1 &&
        !dayIds.has(exercise.id) &&
        replacementKeepsOverlap(result, slots, index, exercise.id),
      )?.exercise;
      if (!alternative) continue;
      result[index] = alternative;
      replaced = true;
    }
    if (!replaced) break;
  }
  return result;
}

export function matchesSlot(exercise: ExerciseCandidate, slot: TrainingSlot) {
  if (!slot.patterns.includes(exercise.pattern)) return false;
  if (complexityRank[exercise.technicalComplexity ?? "low"] > complexityRank[slot.maxTechnicalComplexity]) return false;
  if (slot.role === "CONDITIONING") return exercise.category === "cardio" || exercise.pattern === "carry";
  if (slot.role === "MOBILITY" || slot.role === "CORRECTIVE")
    return exercise.category === "mobility" || ["posture", "core_anti_rotation"].includes(exercise.pattern);
  return exercise.category === "strength" || exercise.pattern === "carry";
}

function rankForSlot(
  candidate: RankedCandidate,
  slot: TrainingSlot,
  profile: NormalizedTrainingProfile,
  input: PlanInput,
  compatible: ExerciseCandidate[],
) {
  const exercise = candidate.exercise;
  let score = candidate.score;
  if (slot.role === "CONDITIONING" && exercise.category === "cardio") score += 100;
  const patternIndex = slot.patterns.indexOf(exercise.pattern);
  // The architecture's first pattern is the day-level programming intent.
  // Give it enough weight to avoid a globally popular exercise silently
  // turning (for example) a hinge slot into another squat slot.
  score += patternIndex === 0 ? 76 : Math.max(8, 28 - patternIndex * 6);
  if (exercise.primaryMuscles?.some((muscle) => slot.targetMuscles.includes(muscle))) score += 8;
  if (slot.priority === "high" && exercise.trainingRole?.includes("primary")) score += 5;
  if (slot.position < 2 && exercise.fatigueProfile === "high") score += 4;
  if (slot.position >= 4 && exercise.fatigueProfile === "high") score -= 14;
  if (profile.experience === "beginner" && exercise.stabilityProfile === "low") score -= 10;
  const missingMetadata = [
    exercise.exerciseFamily,
    exercise.trainingRole,
    exercise.primaryMuscles?.length ? exercise.primaryMuscles : undefined,
    exercise.environmentProfile,
    exercise.technicalComplexity,
    exercise.stabilityProfile,
    exercise.fatigueProfile,
  ].filter((value) => value == null).length;
  score -= missingMetadata * 14;
  if (input.preferences?.[exercise.id] === "like") score += 125;
  const progression = recommendProgression(exercise.id, input.performanceHistory);
  if (progression.state === "PROGRESS" || progression.state === "MAINTAIN") score += 10;
  const isCommercialGym = profile.gymProfile === "STANDARD_COMMERCIAL_GYM" && profile.workoutStyle === "gym_first";
  const environment = exercise.environmentProfile;
  if (isCommercialGym) {
    if (environment === "commercial_machine" || environment === "commercial_cable") score += 22;
    else if (environment === "commercial_free_weight") score += 10;
    const exactGymAlternative = compatible.some((option) =>
      option.id !== exercise.id &&
      option.pattern === exercise.pattern &&
      ["commercial_machine", "commercial_cable", "commercial_free_weight"].includes(option.environmentProfile ?? ""),
    );
    if (environment === "bodyweight_floor" && exactGymAlternative) score -= 52;
  }
  score += Math.round(slot.programmingValue / 5);
  return score;
}

function prescriptionFor(
  exercise: ExerciseCandidate,
  role: TrainingRole,
  strategy: GoalStrategy,
  sessionMinutes: number,
) {
  if (exercise.category === "cardio")
    return {
      sets: 1,
      repMin: 0,
      repMax: 0,
      restSeconds: 0,
      targetDurationSeconds: Math.max(300, Math.round(sessionMinutes * 60 * 0.2)),
    };
  const primary = role.startsWith("PRIMARY");
  const secondary = role.startsWith("SECONDARY");
  const sets = primary ? strategy.primarySets : secondary ? strategy.secondarySets : strategy.accessorySets;
  const [baseMin, baseMax] = strategy.preferredRepRange;
  const secondaryMin = strategy.goal === "strength" ? 6 : baseMin;
  const secondaryMax = strategy.goal === "strength" ? 8 : baseMax;
  return {
    sets,
    repMin: primary ? baseMin : secondary ? secondaryMin : Math.max(baseMin, strategy.goal === "strength" ? 8 : baseMin),
    repMax: primary ? baseMax : secondary ? secondaryMax : Math.max(baseMax, strategy.goal === "strength" ? 12 : baseMax),
    restSeconds: primary
      ? strategy.restSeconds.primary
      : secondary
        ? strategy.restSeconds.secondary
        : strategy.restSeconds.accessory,
  };
}

function explainChoice(exercise: ExerciseCandidate, slot: TrainingSlot, strategy: GoalStrategy) {
  const equipment = exercise.environmentProfile?.replaceAll("_", " ") ?? "equipamento disponível";
  const role = slot.role.toLowerCase().replaceAll("_", " ");
  const weeklyReason = slot.needStatus === "UNMET"
    ? "cobrindo uma necessidade ainda ausente na semana"
    : slot.needStatus === "PARTIALLY_COVERED"
      ? "completando uma necessidade parcialmente coberta na semana"
      : "mantendo uma exposição semanal intencional";
  if (slot.role === "CORRECTIVE")
    return `${exercise.name} foi incluído como trabalho complementar porque a semana ainda não cobre suficientemente esta função; atende ${exercise.pattern} e apoia ${strategy.label.toLowerCase()}.`;
  return `${exercise.name} atende o padrão ${exercise.pattern} como ${role}, apoia ${strategy.label.toLowerCase()} e foi mantido ${weeklyReason}, com ${equipment}.`;
}

export function exerciseFamily(exercise: ExerciseCandidate) {
  return exercise.exerciseFamily ?? `${exercise.pattern}:${exercise.environmentProfile ?? "generic"}`;
}

function selectedForDay(picks: ExerciseCandidate[], slots: TrainingSlot[], dayIndex: number) {
  return picks.filter((_, index) => slots[index]?.dayIndex === dayIndex);
}

function weeklyImbalancePenalty(picks: ExerciseCandidate[]) {
  const pushes = picks.filter((exercise) => exercise.pattern.endsWith("push")).length;
  const pulls = picks.filter((exercise) => exercise.pattern.endsWith("pull")).length;
  const lower = picks.filter((exercise) => ["squat", "hinge", "hip_extension", "knee_extension", "knee_flexion"].includes(exercise.pattern)).length;
  const upper = pushes + pulls;
  return Math.max(0, Math.abs(pushes - pulls) - 1) * 4 + Math.max(0, Math.abs(lower - upper) - 2) * 2;
}

function signature(picks: ExerciseCandidate[]) {
  return picks.map((exercise) => exercise.id).join("|");
}

export function determinismKey(days: GeneratedDay[], catalogVersion = "catalog-unknown") {
  const value = `${catalogVersion}|${days.flatMap((day) => day.exercises.map((exercise) => exercise.exerciseId)).join("|")}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `v221-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
