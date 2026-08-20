import type { MatchExercise, MatchResult, MediaCandidateText } from "./types";

export function normalizeMediaText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(file|video|webm|ogv|mp4|gif)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const movementTerms: Record<string, string[]> = {
  squat: ["squat", "leg press", "knee extension", "hip extension"],
  hinge: ["deadlift", "hip hinge"],
  horizontal_push: [
    "chest press",
    "bench press",
    "push up",
    "pec deck",
    "chest fly",
  ],
  vertical_push: ["shoulder press", "overhead press", "lateral raise"],
  horizontal_pull: ["row", "rowing", "reverse fly", "face pull"],
  vertical_pull: ["pulldown", "pull down", "pull up", "chin up"],
  carry: ["carry", "farmer walk", "farmers walk"],
  core_anti_extension: ["plank", "dead bug"],
  core_anti_rotation: ["pallof", "anti rotation"],
  hip_extension: ["hip thrust", "glute kickback", "hip extension"],
  knee_extension: ["leg extension", "knee extension"],
  knee_flexion: ["leg curl", "hamstring curl", "knee flexion"],
  cardio: ["walking", "treadmill", "bicycle", "bike", "elliptical"],
  mobility: ["mobility", "extension", "stretch"],
  posture: [
    "posture",
    "wall slide",
    "wall angel",
    "chin tuck",
    "retraction",
    "face pull",
    "reverse fly",
  ],
};
const equipmentGroups: Record<string, string[]> = {
  machine: [
    "machine",
    "leg press",
    "hack squat",
    "smith",
    "pec deck",
    "treadmill",
    "elliptical",
    "stationary bike",
  ],
  cable: ["cable", "pulley", "rope", "pulldown"],
  barbell: ["barbell", "olympic bar"],
  dumbbell: ["dumbbell", "free weight"],
  kettlebell: ["kettlebell"],
  bodyweight: ["bodyweight", "body weight", "calisthenic"],
};
const demoTerms = [
  "exercise",
  "demonstration",
  "training",
  "workout",
  "strengthening",
  "gym",
];
const nonExerciseTerms = [
  "music",
  "concert",
  "gameplay",
  "video game",
  "dance performance",
  "locomotive",
  "rowing boat",
  "commercial",
  "advertisement",
  "smoking",
  "exercise device",
];
const genericTitles = new Set([
  "row",
  "press",
  "walking",
  "exercise",
  "training",
  "squat",
]);
const hasPhrase = (text: string, phrase: string) =>
  Boolean(phrase) && ` ${text} `.includes(` ${phrase} `);
const containsAny = (text: string, values: string[]) =>
  values.some((value) => hasPhrase(text, normalizeMediaText(value)));
const tokens = (value: string) =>
  new Set(
    normalizeMediaText(value)
      .split(" ")
      .filter((token) => token.length > 2),
  );

function equipmentSignals(exercise: MatchExercise, context: string) {
  const expected = exercise.equipment.map(normalizeMediaText);
  const exact = expected
    .filter((value) => !["machine", "bodyweight", "bench"].includes(value))
    .some((value) => hasPhrase(context, value));
  const expectedGroups = Object.entries(equipmentGroups)
    .filter(([, terms]) => expected.some((value) => containsAny(value, terms)))
    .map(([group]) => group);
  const candidateGroups = Object.entries(equipmentGroups)
    .filter(([, terms]) => containsAny(context, terms))
    .map(([group]) => group);
  const compatible = expectedGroups.some((group) =>
    candidateGroups.includes(group),
  );
  const specific = expectedGroups.filter((group) => group !== "machine");
  const conflicting = candidateGroups.some(
    (group) =>
      specific.length > 0 &&
      !specific.includes(group) &&
      !["machine", "cable"].includes(group),
  );
  const machineMismatch =
    expectedGroups.includes("machine") &&
    candidateGroups.some((group) =>
      ["barbell", "dumbbell", "kettlebell", "bodyweight"].includes(group),
    );
  return { exact, compatible, wrong: conflicting || machineMismatch };
}
function subtypeMismatch(exercise: MatchExercise, title: string) {
  const expectedSlug = normalizeMediaText(exercise.slug);
  const expected = normalizeMediaText(
    `${exercise.slug} ${exercise.nameEn ?? ""}`,
  );
  const conflictingQualifier = [
    ["incline", "flat"],
    ["seated", "lying"],
    ["seated", "prone"],
    ["one arm", "two arm"],
    ["neutral", "wide grip"],
    ["supinated", "pronated"],
  ].some(
    ([wanted, other]) => hasPhrase(expected, wanted) && hasPhrase(title, other),
  );
  const requiredQualifierMissing = [
    "incline",
    "seated",
    "lying",
    "prone",
    "one arm",
    "neutral",
    "supinated",
  ].some(
    (qualifier) =>
      hasPhrase(expectedSlug, qualifier) &&
      !hasPhrase(title, qualifier) &&
      /press|row|curl|pulldown/.test(title),
  );
  const siblingExercise =
    (/hack|smith|goblet/.test(expected) && hasPhrase(title, "leg press")) ||
    (exercise.slug === "machine-fly" &&
      /chest press|bench press/.test(title)) ||
    (exercise.slug === "machine-chest-press" &&
      /pec deck|chest fly/.test(title)) ||
    (exercise.slug === "one-arm-row" &&
      /row machine|seated row|cable row/.test(title)) ||
    (exercise.slug === "lateral-raise" &&
      /shoulder press|overhead press/.test(title)) ||
    (exercise.slug === "thoracic-extension" &&
      /leg extension|arm extension|back extension/.test(title));
  return conflictingQualifier || requiredQualifierMissing || siblingExercise;
}

export function scoreMediaMatch(
  exercise: MatchExercise,
  candidate: MediaCandidateText,
): MatchResult {
  const title = normalizeMediaText(candidate.title);
  const context = normalizeMediaText(
    [
      candidate.title,
      candidate.description,
      ...candidate.categories,
      candidate.source ?? "",
    ].join(" "),
  );
  const canonical = [exercise.nameEn, exercise.namePt, exercise.slug]
    .filter((value): value is string => Boolean(value))
    .map(normalizeMediaText);
  const aliases = exercise.aliases.map(normalizeMediaText);
  const exactCanonical = canonical.some((name) => hasPhrase(title, name));
  const matchedAlias = aliases.find((alias) => hasPhrase(title, alias));
  const referenceTokens = tokens([...canonical, ...aliases].join(" ")),
    titleTokens = tokens(title);
  const overlap = [...titleTokens].filter((token) =>
    referenceTokens.has(token),
  ).length;
  const titleTokenScore = Math.round(
    Math.min(25, titleTokens.size ? (overlap / titleTokens.size) * 25 : 0),
  );
  const equipment = equipmentSignals(exercise, context);
  const wrongEquipment =
    equipment.wrong && !(exercise.slug === "goblet-squat" && matchedAlias);
  const movement = containsAny(
    context,
    movementTerms[exercise.movementPattern] ?? [],
  );
  const muscle = containsAny(context, exercise.muscles);
  const relevantCategory = candidate.categories.some((value) =>
    /exercise|strength training|weight training|physical activity|fitness/i.test(
      value,
    ),
  );
  const demoKeyword = containsAny(context, demoTerms);
  const cdcSource =
    /centers for disease control|\bcdc\b|cdcstreaminghealth/i.test(context);
  const differentSubtype = subtypeMismatch(exercise, title),
    ambiguousTitle = genericTitles.has(title);
  const nonExercise = containsAny(context, nonExerciseTerms);
  const video = ["video/webm", "video/mp4", "image/gif"].includes(
    candidate.mime ?? "video/webm",
  );
  let score =
    (exactCanonical ? 60 : matchedAlias ? 50 : 0) +
    titleTokenScore +
    (equipment.exact ? 30 : equipment.compatible ? 15 : 0) +
    (movement ? 25 : 0) +
    (muscle ? 10 : 0) +
    (relevantCategory ? 10 : 0) +
    (demoKeyword ? 10 : 0) +
    (cdcSource ? 10 : 0) +
    (video ? 10 : 0) -
    (wrongEquipment ? 30 : 0) -
    (differentSubtype ? 30 : 0) -
    (ambiguousTitle ? 20 : 0) -
    (nonExercise ? 100 : 0);
  if (!movement && !exactCanonical && !matchedAlias) score -= 50;
  if (wrongEquipment || differentSubtype) score = Math.min(score, 69);
  if (!movement && !exactCanonical && !matchedAlias)
    score = Math.min(score, 54);
  if (nonExercise) score = 0;
  score = Math.max(0, Math.min(100, score));
  const confidence =
    score >= 85
      ? "strong"
      : score >= 70
        ? "candidate"
        : score >= 55
          ? "low"
          : "ignored";
  const positiveReasons = [
    exactCanonical && "canonical name",
    matchedAlias && `alias: ${matchedAlias}`,
    titleTokenScore > 0 && `title overlap: ${titleTokenScore}/25`,
    equipment.exact && "equipment exact",
    !equipment.exact && equipment.compatible && "equipment compatible",
    movement && `movement: ${exercise.movementPattern}`,
    muscle && "primary muscle",
    relevantCategory && "relevant category",
    demoKeyword && "exercise/demo keyword",
    cdcSource && "CDC trusted collection",
    video && "video media",
  ].filter((value): value is string => Boolean(value));
  const negativeReasons = [
    wrongEquipment && "wrong equipment",
    differentSubtype && "different exercise subtype",
    !movement && !exactCanonical && !matchedAlias && "different movement",
    ambiguousTitle && "ambiguous generic title",
    nonExercise && "non-exercise media",
  ].filter((value): value is string => Boolean(value));
  return {
    score,
    eligible: confidence !== "ignored",
    confidence,
    positiveReasons,
    negativeReasons,
    details: {
      exactCanonical,
      exactAlias: Boolean(matchedAlias),
      matchedAlias: matchedAlias ?? "",
      titleTokenScore,
      equipmentExact: equipment.exact,
      equipmentCompatible: equipment.compatible,
      wrongEquipment,
      movementPattern: movement,
      muscle,
      relevantCategory,
      demoKeyword,
      cdcSource,
      differentSubtype,
      ambiguousTitle,
      nonExercise,
      video,
      positiveReasons,
      negativeReasons,
    },
  };
}
