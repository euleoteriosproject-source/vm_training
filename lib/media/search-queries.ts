import type { MatchExercise } from "./types";
import { normalizeMediaText } from "./matching.ts";

export const expandedAliases: Record<string, string[]> = {
  "leg-press": ["seated leg press", "leg press machine", "machine leg press"],
  "hack-squat": ["hack squat", "hack squat machine", "machine hack squat"],
  "smith-squat": [
    "smith squat",
    "smith machine squat",
    "smith machine back squat",
  ],
  "goblet-squat": [
    "goblet squat",
    "kettlebell goblet squat",
    "dumbbell goblet squat",
  ],
  "leg-extension": [
    "leg extension",
    "leg extension machine",
    "knee extension",
    "seated leg extension",
  ],
  "lying-leg-curl": [
    "leg curl",
    "lying leg curl",
    "prone leg curl",
    "hamstring curl",
    "lying hamstring curl",
  ],
  "seated-leg-curl": [
    "seated leg curl",
    "seated hamstring curl",
    "leg curl machine",
  ],
  "hip-thrust": [
    "hip thrust",
    "barbell hip thrust",
    "weighted hip thrust",
    "bench hip thrust",
    "glute hip thrust",
  ],
  "machine-glute": [
    "glute kickback machine",
    "machine glute kickback",
    "hip extension machine",
  ],
  "calf-raise": ["standing calf raise", "calf raise", "calf raise machine"],
  "lat-pulldown": [
    "lat pulldown",
    "lat pull down",
    "front lat pulldown",
    "cable pulldown",
    "pulldown machine",
    "wide grip pulldown",
  ],
  "neutral-pulldown": [
    "neutral grip lat pulldown",
    "neutral pulldown",
    "close grip pulldown",
  ],
  "supinated-pulldown": [
    "reverse grip lat pulldown",
    "supinated pulldown",
    "underhand pulldown",
  ],
  "seated-row": [
    "seated row",
    "seated cable row",
    "low row",
    "cable row",
    "low cable row",
  ],
  "machine-row": [
    "row machine",
    "seated row machine",
    "machine row",
    "chest supported row machine",
  ],
  "one-arm-row": [
    "one arm dumbbell row",
    "single arm dumbbell row",
    "one arm row",
  ],
  "reverse-fly": [
    "reverse fly",
    "reverse fly machine",
    "rear delt fly",
    "rear delt machine",
    "reverse pec deck",
  ],
  "face-pull": [
    "face pull",
    "cable face pull",
    "rope face pull",
    "rear delt rope pull",
    "cable rear delt pull",
  ],
  "machine-chest-press": [
    "machine chest press",
    "chest press machine",
    "seated chest press",
    "chest press exercise",
  ],
  "incline-machine-press": [
    "incline chest press machine",
    "incline machine press",
    "incline press machine",
  ],
  "machine-fly": [
    "pec deck",
    "pec deck fly",
    "machine chest fly",
    "chest fly machine",
  ],
  "machine-shoulder-press": [
    "shoulder press",
    "machine shoulder press",
    "seated shoulder press",
    "overhead press machine",
    "shoulder press exercise",
  ],
  "lateral-raise": [
    "dumbbell lateral raise",
    "lateral raise",
    "side lateral raise",
  ],
  "dead-bug": ["dead bug", "dead bug exercise", "core dead bug"],
  plank: ["forearm plank", "plank exercise", "abdominal plank"],
  "pallof-press": [
    "pallof press",
    "cable pallof press",
    "anti rotation press",
    "anti-rotation press",
  ],
  "farmer-walk": [
    "farmer walk",
    "farmers walk",
    "farmer carry",
    "loaded carry",
    "kettlebell farmer walk",
  ],
  "wall-slide": [
    "wall slide",
    "wall slides exercise",
    "wall angel",
    "wall shoulder slide",
  ],
  "chin-tuck": ["chin tuck", "cervical retraction", "neck retraction exercise"],
  "thoracic-extension": [
    "thoracic extension",
    "thoracic spine extension",
    "foam roller thoracic extension",
  ],
  treadmill: [
    "treadmill walking",
    "walking on treadmill",
    "treadmill exercise",
  ],
  "incline-treadmill": [
    "incline treadmill walking",
    "incline walking",
    "treadmill incline exercise",
  ],
  bike: ["stationary bicycle", "exercise bike", "stationary bike exercise"],
  elliptical: ["elliptical trainer", "cross trainer", "elliptical exercise"],
  walking: ["brisk walking", "walking exercise", "fitness walking"],
};

function queryKey(value: string) {
  return normalizeMediaText(value).replace(/\b([a-z]{4,})s\b/g, "$1");
}

export function buildExerciseSearchQueries(
  exercise: MatchExercise,
  max = Number(process.env.MAX_QUERIES_PER_EXERCISE ?? 12),
) {
  const base = [
    exercise.nameEn,
    ...exercise.aliases,
    ...(expandedAliases[exercise.slug] ?? []),
  ].filter((value): value is string => Boolean(value));
  const primary = base[0] ?? exercise.slug.replaceAll("-", " ");
  const generated = [
    ...base,
    `${primary} exercise`,
    `${primary} exercise demonstration`,
    `${primary} strength training`,
    exercise.equipment[0] && `${exercise.equipment[0]} ${primary}`,
    exercise.muscles[0] && `${exercise.muscles[0]} ${primary} exercise`,
  ].filter((value): value is string => Boolean(value));
  const seen = new Set<string>();
  return generated
    .map((value) => normalizeMediaText(value))
    .filter((value) => {
      const key = queryKey(value);
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(1, max));
}
