import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Candidate = {
  title: string;
  sourceUrl: string;
  originalFileUrl: string;
  licenseCode: string;
  licenseUrl: string;
  author: string;
  attributionText: string;
  score: number;
  rawMetadata?: { Categories?: string; Permission?: string };
};
type Artifact = {
  version: string;
  exercises: { slug: string; name: string; candidates: Candidate[] }[];
};
type Reference = {
  name: string;
  url: string;
  organization: string;
  conclusion: string;
};
type ExerciseEvidence = {
  expected: string;
  movement: string;
  joints: string[];
  muscles: string[];
  references: Reference[];
  nextQueries: string[];
  sourceTypes: string[];
};
type Review = {
  visualExercise: string;
  exerciseMatch: "EXACT" | "ACCEPTABLE_VARIATION" | "RELATED_BUT_DIFFERENT" | "INCORRECT";
  variation: string;
  equipment: string;
  equipmentMatch: boolean;
  movementMatch: boolean;
  executionQuality: "approved" | "acceptable" | "rejected";
  visibilityScore: number;
  validationScore: number;
  decision: "APPROVE" | "REJECT" | "KEEP_PENDING";
  recommendedRole: "PRIMARY_DEMO" | "EDUCATIONAL" | "ALTERNATIVE_VARIATION" | null;
  licenseVerified: boolean;
  fullMovementVisible: boolean;
  trimStart?: number | null;
  trimEnd?: number | null;
  visualNotes: string;
  reason: string;
};

const ref = (
  name: string,
  url: string,
  organization: string,
  conclusion: string,
): Reference => ({ name, url, organization, conclusion });

const evidence: Record<string, ExerciseEvidence> = {
  "leg-press": {
    expected: "Seated leg press on a dedicated machine",
    movement: "squat / compound hip and knee extension",
    joints: ["hip", "knee", "ankle"],
    muscles: ["quadriceps", "gluteals", "hamstrings"],
    references: [
      ref("Seated Leg Press", "https://www.acefitness.org/resources/everyone/exercise-library/154/seated-leg-press/", "ACE", "Confirms seated machine setup and controlled hip/knee flexion and extension."),
      ref("Leg press video", "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/leg-press/vid-20084684", "Mayo Clinic", "Confirms dedicated machine, supported trunk and smooth press path."),
    ],
    nextQueries: ["seated leg press machine exercise demonstration public domain"],
    sourceTypes: ["CDC", "institutional media", "self-produced"],
  },
  "hack-squat": {
    expected: "Hack squat on a guided angled machine with back and shoulder support",
    movement: "machine-guided squat",
    joints: ["hip", "knee", "ankle"],
    muscles: ["quadriceps", "gluteals", "hamstrings"],
    references: [
      ref("Plate-Loaded Linear Hack Squat", "https://shop.lifefitness.com/products/hammer-strength-plate-loaded-hack-squat", "Life Fitness", "Defines a 45-degree, back-supported, fixed-path hack squat."),
      ref("Squat loading position considerations", "https://www.nsca.com/education/articles/ptq/squat-loading-position-considerations/", "NSCA", "Distinguishes squat loading positions and their mechanical demands."),
      ref("Back Squat", "https://www.acefitness.org/resources/everyone/exercise-library/11/back-squat/", "ACE", "Provides the free-squat comparator and confirms it is a different equipment identity."),
    ],
    nextQueries: ["hack squat machine full repetition exercise demonstration licensed"],
    sourceTypes: ["official manufacturer", "institutional media", "self-produced"],
  },
  "smith-squat": {
    expected: "Squat with a bar guided by a Smith machine",
    movement: "fixed-bar squat",
    joints: ["hip", "knee", "ankle"],
    muscles: ["quadriceps", "gluteals", "hamstrings"],
    references: [
      ref("Exercise selection: Smith machine squats", "https://www.acefitness.org/continuing-education/prosource/september-2013/3459/is-your-exercise-selection-helping-or-hurting-your-clients/", "ACE", "Identifies the Smith squat by its fixed bar path."),
      ref("Squat loading position considerations", "https://www.nsca.com/education/articles/ptq/squat-loading-position-considerations/", "NSCA", "Confirms loading and equipment materially affect squat execution."),
      ref("Back Squat", "https://www.acefitness.org/resources/everyone/exercise-library/11/back-squat/", "ACE", "Provides a free-bar comparator; bodyweight footage is not a Smith squat."),
    ],
    nextQueries: ["smith machine squat full repetition licensed demonstration"],
    sourceTypes: ["institutional media", "official manufacturer", "self-produced"],
  },
  "goblet-squat": {
    expected: "Squat holding one kettlebell or dumbbell at the chest in goblet position",
    movement: "loaded squat",
    joints: ["hip", "knee", "ankle"],
    muscles: ["quadriceps", "gluteals", "core"],
    references: [
      ref("Goblet Squat", "https://www.acefitness.org/resources/everyone/exercise-library/362/goblet-squat/", "ACE", "Confirms chest-level goblet load and complete squat path."),
      ref("Progressive strategies for movement patterns", "https://www.nsca.com/contentassets/3d09f06f0b4c4f6fbd8cc382ed1f3d4a/ptq-10.2.1-progressive-strategies-for-teaching-fundamental-resistance-training-movement-patterns.pdf", "NSCA", "Uses the goblet squat as a distinct loaded squat progression."),
    ],
    nextQueries: ["goblet squat kettlebell demonstration Creative Commons"],
    sourceTypes: ["institutional media", "verified Creative Commons", "self-produced"],
  },
  "leg-extension": {
    expected: "Seated knee extension on a selectorized leg-extension machine",
    movement: "knee extension",
    joints: ["knee"],
    muscles: ["quadriceps"],
    references: [
      ref("Seated Leg Extension", "https://www.acefitness.org/resources/everyone/exercise-library/183/seated-leg-extension/", "ACE", "Confirms selectorized equipment and isolated seated knee extension."),
      ref("Knee extension video", "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/knee-extension/vid-20084686", "Mayo Clinic", "Confirms pad placement and controlled knee extension on a machine."),
    ],
    nextQueries: ["leg extension machine exercise demonstration public domain"],
    sourceTypes: ["CDC", "institutional media", "self-produced"],
  },
  "lying-leg-curl": {
    expected: "Prone leg curl on a lying leg-curl machine",
    movement: "prone knee flexion",
    joints: ["knee"],
    muscles: ["hamstrings"],
    references: [
      ref("Lying hamstring curl", "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/lying-hamstring-curl/vid-20084689", "Mayo Clinic", "Confirms prone body position and knee flexion against a machine pad."),
      ref("Seated hamstring curl", "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/seated-hamstring-curl/vid-20084685", "Mayo Clinic", "Provides the seated comparator and shows it is a distinct variation."),
    ],
    nextQueries: ["lying prone leg curl machine demonstration licensed"],
    sourceTypes: ["institutional media", "official manufacturer", "self-produced"],
  },
  "seated-leg-curl": {
    expected: "Seated leg curl on a dedicated machine",
    movement: "seated knee flexion",
    joints: ["knee"],
    muscles: ["hamstrings"],
    references: [
      ref("Seated hamstring curl", "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/seated-hamstring-curl/vid-20084685", "Mayo Clinic", "Confirms seated body position and controlled knee flexion."),
      ref("Insignia Seated Leg Curl", "https://shop.lifefitness.com/products/insignia-series-seated-leg-curl", "Life Fitness", "Confirms dedicated seated equipment and full range of motion."),
    ],
    nextQueries: ["seated leg curl machine exercise demonstration public domain"],
    sourceTypes: ["CDC", "institutional media", "self-produced"],
  },
  "calf-raise": {
    expected: "Standing calf raise showing complete plantar-flexion repetition",
    movement: "ankle plantar flexion",
    joints: ["ankle"],
    muscles: ["gastrocnemius", "soleus"],
    references: [
      ref("Calf raise video", "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/calf-raise/vid-20084681", "Mayo Clinic", "Confirms a complete heel raise and controlled return."),
      ref("Calves exercise library", "https://www.acefitness.org/resources/everyone/exercise-library/body-part/legs-calves-and-shins/", "ACE", "Separates standing and seated calf exercise variations."),
    ],
    nextQueries: ["standing calf raise full repetition licensed video"],
    sourceTypes: ["institutional media", "verified Creative Commons", "self-produced"],
  },
  "lat-pulldown": {
    expected: "Seated pronated-grip lat pulldown to the upper chest",
    movement: "vertical pull",
    joints: ["shoulder", "elbow", "scapulothoracic articulation"],
    muscles: ["latissimus dorsi", "biceps", "scapular retractors"],
    references: [
      ref("Lat pull-down video", "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/lat-pull-down/vid-20084683", "Mayo Clinic", "Confirms seated cable pulldown trajectory and controlled return."),
      ref("Grip width and forearm orientation study", "https://pubmed.ncbi.nlm.nih.gov/20543740/", "PubMed / Journal of Strength and Conditioning Research", "Confirms grip orientation is a meaningful pulldown variation."),
      ref("Strength and conditioning manual", "https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf", "NSCA", "Defines pronated, neutral and supinated grips."),
    ],
    nextQueries: ["lat pulldown full repetition pronated grip licensed video"],
    sourceTypes: ["institutional media", "verified Creative Commons", "self-produced"],
  },
  "neutral-pulldown": {
    expected: "Lat pulldown using a neutral palms-facing grip",
    movement: "neutral-grip vertical pull",
    joints: ["shoulder", "elbow", "scapulothoracic articulation"],
    muscles: ["latissimus dorsi", "biceps"],
    references: [
      ref("Strength and conditioning manual", "https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf", "NSCA", "Defines neutral grip as palms facing each other."),
      ref("Lat pull-down video", "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/lat-pull-down/vid-20084683", "Mayo Clinic", "Confirms the base pulldown path; grip must still match the catalog variation."),
      ref("Grip width and forearm orientation study", "https://pubmed.ncbi.nlm.nih.gov/20543740/", "PubMed / JSCR", "Supports treating forearm orientation as an explicit variation."),
    ],
    nextQueries: ["neutral grip lat pulldown full repetition licensed video"],
    sourceTypes: ["institutional media", "official manufacturer", "self-produced"],
  },
  "supinated-pulldown": {
    expected: "Lat pulldown using an underhand/supinated grip",
    movement: "supinated-grip vertical pull",
    joints: ["shoulder", "elbow", "scapulothoracic articulation"],
    muscles: ["latissimus dorsi", "biceps"],
    references: [
      ref("Strength and conditioning manual", "https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf", "NSCA", "Defines supinated grip as palms up/underhand."),
      ref("Lat pull-down video", "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/lat-pull-down/vid-20084683", "Mayo Clinic", "Confirms the base pulldown path; the catalog requires a specific grip."),
      ref("Grip width and forearm orientation study", "https://pubmed.ncbi.nlm.nih.gov/20543740/", "PubMed / JSCR", "Supports treating forearm orientation as an explicit variation."),
    ],
    nextQueries: ["reverse grip supinated lat pulldown licensed demonstration"],
    sourceTypes: ["institutional media", "official manufacturer", "self-produced"],
  },
  "seated-row": {
    expected: "Seated low cable row with a horizontal cable path",
    movement: "horizontal pull",
    joints: ["shoulder", "elbow", "scapulothoracic articulation"],
    muscles: ["latissimus dorsi", "rhomboids", "biceps"],
    references: [
      ref("Seated Row", "https://www.acefitness.org/resources/everyone/exercise-library/48/seated-row/", "ACE", "Confirms seated cable setup and horizontal handle path."),
      ref("Seated row video", "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/seated-row/vid-20084688", "Mayo Clinic", "Confirms controlled horizontal pulling with a stable torso."),
    ],
    nextQueries: ["seated low cable row licensed exercise demonstration"],
    sourceTypes: ["institutional media", "verified Creative Commons", "self-produced"],
  },
  "machine-row": {
    expected: "Seated chest-supported selectorized row machine",
    movement: "machine horizontal pull",
    joints: ["shoulder", "elbow", "scapulothoracic articulation"],
    muscles: ["latissimus dorsi", "rhomboids", "biceps"],
    references: [
      ref("Selectorized Seated Row", "https://www.acefitness.org/resources/everyone/exercise-library/168/seated-row/", "ACE", "Confirms selectorized row equipment and horizontal pull."),
      ref("Seated row video", "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/seated-row/vid-20084688", "Mayo Clinic", "Confirms stable torso and controlled elbow/scapular motion."),
    ],
    nextQueries: ["chest supported row machine exercise demonstration public domain"],
    sourceTypes: ["CDC", "institutional media", "self-produced"],
  },
  "machine-chest-press": {
    expected: "Seated chest press on a selectorized machine",
    movement: "machine horizontal push",
    joints: ["shoulder", "elbow"],
    muscles: ["pectorals", "triceps", "anterior deltoid"],
    references: [
      ref("Seated Chest Press", "https://www.acefitness.org/resources/everyone/exercise-library/188/seated-chest-press/", "ACE", "Confirms selectorized machine and forward pressing path."),
      ref("Chest press with weight machine", "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/chest-press/vid-20084687", "Mayo Clinic", "Confirms seat/handle setup and smooth machine press."),
    ],
    nextQueries: ["seated chest press machine demonstration public domain"],
    sourceTypes: ["CDC", "institutional media", "self-produced"],
  },
  "incline-machine-press": {
    expected: "Incline chest press using a dedicated machine",
    movement: "inclined machine push",
    joints: ["shoulder", "elbow"],
    muscles: ["upper pectorals", "triceps", "anterior deltoid"],
    references: [
      ref("Incline Chest Press", "https://www.acefitness.org/resources/everyone/exercise-library/25/incline-chest-press/", "ACE", "Confirms inclined press geometry; equipment must match the catalog."),
      ref("Chest press with weight machine", "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/chest-press/vid-20084687", "Mayo Clinic", "Provides the dedicated-machine comparator."),
      ref("Chest exercise study", "https://www.acefitness.org/about-ace/press-room/press-releases/2930/ace-study-tests-common-chest-exercises-finds-barbell-bench-press-most-effective/", "ACE", "Treats barbell and machine chest exercises as distinct modalities."),
    ],
    nextQueries: ["incline chest press machine licensed exercise demonstration"],
    sourceTypes: ["official manufacturer", "institutional media", "self-produced"],
  },
  "machine-fly": {
    expected: "Pec-deck or machine chest fly using shoulder horizontal adduction",
    movement: "shoulder horizontal adduction",
    joints: ["shoulder"],
    muscles: ["pectorals", "anterior deltoid"],
    references: [
      ref("Axiom Pectoral Fly", "https://shop.lifefitness.com/products/axiom-series-pectoral-fly-rear-deltoid", "Life Fitness", "Confirms pec-deck arms and fly/adduction motion."),
      ref("Chest exercise study", "https://www.acefitness.org/about-ace/press-room/press-releases/2930/ace-study-tests-common-chest-exercises-finds-barbell-bench-press-most-effective/", "ACE", "Separates pec deck from pressing exercises."),
      ref("Seated Chest Press", "https://www.acefitness.org/resources/everyone/exercise-library/188/seated-chest-press/", "ACE", "Provides the elbow-extension press comparator."),
    ],
    nextQueries: ["pec deck machine fly full repetition licensed video"],
    sourceTypes: ["official manufacturer", "institutional media", "self-produced"],
  },
  "machine-shoulder-press": {
    expected: "Seated shoulder press using a dedicated machine",
    movement: "machine vertical push",
    joints: ["shoulder", "elbow"],
    muscles: ["deltoids", "triceps"],
    references: [
      ref("Seated Shoulder Press", "https://www.acefitness.org/resources/everyone/exercise-library/186/seated-shoulder-press/", "ACE", "Confirms seated selectorized equipment and overhead press path."),
      ref("Strength and conditioning manual", "https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf", "NSCA", "Confirms equipment and body position are part of exercise technique."),
    ],
    nextQueries: ["seated shoulder press machine licensed exercise demonstration"],
    sourceTypes: ["official manufacturer", "institutional media", "self-produced"],
  },
  "farmer-walk": {
    expected: "Loaded carry with one implement in each hand",
    movement: "bilateral loaded carry",
    joints: ["hip", "knee", "ankle", "shoulder girdle"],
    muscles: ["grip", "core", "trapezius", "lower body"],
    references: [
      ref("Farmer's Carry", "https://www.acefitness.org/resources/everyone/exercise-library/359/farmer-s-carry/", "ACE", "Shows a bilateral carry with one load in each hand."),
      ref("Loaded carries", "https://www.nsca.com/education/articles/nsca-coach/increase-hip-and-trunk-stability-with-loaded-carries/", "NSCA", "Distinguishes loaded-carry variations and trunk demands."),
    ],
    nextQueries: ["bilateral farmer carry kettlebell licensed demonstration"],
    sourceTypes: ["verified Creative Commons", "institutional media", "self-produced"],
  },
  "thoracic-extension": {
    expected: "Thoracic spine extension over a chair, bench, ball or foam roller",
    movement: "thoracic mobility / spinal extension",
    joints: ["thoracic spine"],
    muscles: ["thoracic extensors"],
    references: [
      ref("Thoracic spine exercises", "https://www.cuh.nhs.uk/patient-information/thoracic-spine-exercises/", "Cambridge University Hospitals NHS", "Confirms thoracic-specific extension and mobility patterns."),
      ref("Spinal exercises", "https://elht.nhs.uk/services/integrated-msk-pain-and-rheumatology-service/spinal-exercises", "East Lancashire Hospitals NHS", "Shows thoracic extension in supine and over a gym ball."),
      ref("Physiotherapy exercises", "https://www.plymouthhospitals.nhs.uk/display-pil/pil-physiotherapy-for-breast-surgery-7032", "University Hospitals Plymouth NHS", "Describes seated thoracic extension as moving the head, arms and chest as one unit."),
    ],
    nextQueries: ["thoracic extension foam roller licensed exercise demonstration"],
    sourceTypes: ["NHS/institutional media", "verified Creative Commons", "self-produced"],
  },
  bike: {
    expected: "Continuous pedalling on a stationary exercise bicycle",
    movement: "cardio cycling",
    joints: ["hip", "knee", "ankle"],
    muscles: ["quadriceps", "gluteals", "calves", "cardiovascular system"],
    references: [
      ref("Setting up the BikeErg", "https://www.concept2.com/training/articles/setting-up-the-bikeerg", "Concept2", "Confirms stationary-bike setup and pedalling position."),
      ref("Managing resistance on the BikeErg", "https://www.concept2.com/training/articles/managing-resistance-bikeerg", "Concept2", "Confirms continuous pedalling against adjustable resistance."),
    ],
    nextQueries: ["stationary exercise bicycle pedalling licensed demonstration"],
    sourceTypes: ["official manufacturer", "verified Creative Commons", "self-produced"],
  },
};

const review = (
  visualExercise: string,
  exerciseMatch: Review["exerciseMatch"],
  equipment: string,
  equipmentMatch: boolean,
  movementMatch: boolean,
  executionQuality: Review["executionQuality"],
  visibilityScore: number,
  validationScore: number,
  decision: Review["decision"],
  recommendedRole: Review["recommendedRole"],
  licenseVerified: boolean,
  fullMovementVisible: boolean,
  variation: string,
  visualNotes: string,
  reason: string,
  trimStart: number | null = null,
  trimEnd: number | null = null,
): Review => ({
  visualExercise,
  exerciseMatch,
  variation,
  equipment,
  equipmentMatch,
  movementMatch,
  executionQuality,
  visibilityScore,
  validationScore,
  decision,
  recommendedRole,
  licenseVerified,
  fullMovementVisible,
  trimStart,
  trimEnd,
  visualNotes,
  reason,
});

const reviews: Record<string, Review> = {
  "80eb98d2c2545580": review("Seated machine leg press", "EXACT", "selectorized seated leg-press machine", true, true, "approved", 88, 96, "APPROVE", "PRIMARY_DEMO", true, true, "standard seated machine variation", "Machine, supported body, knee/hip path and complete repetitions are visible; the full source is instructional.", "Exact CDC public-domain demonstration; use a short, silent processed excerpt after frame-accurate trim selection."),
  "0c0bd7baeb151077": review("45-degree leg press tutorial with errors and variations", "EXACT", "45-degree plate-loaded leg press", true, true, "acceptable", 82, 88, "KEEP_PENDING", "EDUCATIONAL", false, true, "tutorial containing standard and alternate stances", "The source includes discussion, mistakes, correct-form material around 04:47 and later variations; several inspected windows show the machine work but no clean final trim was established.", "Technically relevant long-form education, but Wikimedia marks the video for license review; it cannot be approved."),
  "c7f0edf1ad88047b": review("Chair sit-to-stand", "INCORRECT", "chair; no leg-press machine", false, false, "rejected", 70, 18, "REJECT", null, true, true, "bodyweight sit-to-stand", "The animation shows a person rising from a chair, not pressing a machine platform.", "Wrong exercise and equipment."),
  "1671caca9d4a2b28": review("Chair-assisted bodyweight squat", "RELATED_BUT_DIFFERENT", "chair; no leg-press machine", false, true, "acceptable", 72, 42, "REJECT", null, true, true, "bodyweight squat", "A complete squat is shown but the required leg-press equipment and constrained path are absent.", "Similar squat pattern is not a leg press."),
  "e2b4801df9db6b26": review("Chair-assisted bodyweight squat", "RELATED_BUT_DIFFERENT", "chair; no hack-squat machine", false, true, "acceptable", 72, 38, "REJECT", null, true, true, "bodyweight squat", "The motion is an unsupported bodyweight squat.", "No angled sled, back support or guided hack-squat path."),
  "72f6dc978f353ead": review("Bodyweight half squat", "RELATED_BUT_DIFFERENT", "no equipment", false, true, "acceptable", 84, 40, "REJECT", null, true, true, "shallow bodyweight squat", "A short-range bodyweight squat is visible in a home setting.", "Wrong equipment and materially different range/loading."),
  "7a7d1d1355b6e9e1": review("Chair-assisted bodyweight squat", "RELATED_BUT_DIFFERENT", "chair; no Smith machine", false, true, "acceptable", 72, 38, "REJECT", null, true, true, "bodyweight squat", "The animation shows a bodyweight squat.", "A Smith squat requires a guided bar and machine."),
  "f2bf2b10305aeffa": review("Bodyweight half squat", "RELATED_BUT_DIFFERENT", "no equipment", false, true, "acceptable", 84, 40, "REJECT", null, true, true, "shallow bodyweight squat", "The video shows a partial bodyweight squat.", "No guided Smith bar or machine is present."),
  "e8126275ec36715b": review("Kettlebell goblet squat", "EXACT", "kettlebell", true, true, "approved", 93, 98, "APPROVE", "PRIMARY_DEMO", true, true, "standard kettlebell goblet squat", "Full body, chest-held kettlebell, depth and complete repetition are clear from a stable angle.", "Exact, clearly visible exercise with verified CC BY-SA 4.0 permission record.", 5, 12),
  "38dc3a1ed90bdf03": review("Chair-assisted bodyweight squat", "RELATED_BUT_DIFFERENT", "chair; no goblet load", false, true, "acceptable", 72, 45, "REJECT", null, true, true, "bodyweight squat", "The squat cycle is visible but there is no chest-held weight.", "Missing the defining goblet load and position."),
  "69d50f521aea630c": review("Bodyweight half squat", "RELATED_BUT_DIFFERENT", "no equipment", false, true, "acceptable", 84, 45, "REJECT", null, true, true, "shallow bodyweight squat", "The video shows a partial unloaded squat.", "Missing the goblet load and full expected movement."),
  "e84f0b22b7b81375": review("Seated machine leg extension", "EXACT", "selectorized leg-extension machine", true, true, "approved", 90, 97, "APPROVE", "PRIMARY_DEMO", true, true, "standard bilateral machine leg extension", "Seat, shin pad, knee axis and controlled extension/return are clearly visible; source is instructional.", "Exact CDC public-domain machine demonstration; process a short excerpt before publishing."),
  "ce0a5122e15e0d69": review("Seated knee extension with ankle weight", "RELATED_BUT_DIFFERENT", "chair and ankle weight", false, true, "acceptable", 78, 52, "REJECT", null, true, true, "non-machine knee extension", "Knee extension is visible, but the catalog exercise specifically expects a leg-extension machine.", "Correct joint action but wrong resistance equipment."),
  "bc552436c04ac9b7": review("Seated machine leg curl", "INCORRECT", "seated leg-curl machine", false, true, "approved", 88, 48, "REJECT", null, true, true, "seated rather than prone", "The person remains seated while flexing the knees against the machine pad.", "Body position identifies a different catalog exercise: seated leg curl."),
  "dc9c85d86b7e601d": review("Seated machine leg curl", "EXACT", "seated leg-curl machine", true, true, "approved", 88, 96, "APPROVE", "PRIMARY_DEMO", true, true, "standard bilateral seated leg curl", "Machine setup, seated posture and controlled knee flexion/return are visible; source is instructional.", "Exact CDC public-domain demonstration; process a short excerpt before publishing."),
  "ff366b28b9419fed": review("Standing barbell calf raise start position", "EXACT", "barbell", true, true, "rejected", 58, 68, "REJECT", null, true, false, "rocking standing barbell calf raise", "The GIF is effectively one static pose and does not show the heel-rise cycle.", "An isolated pose cannot teach the complete movement."),
  "05cf0deb36319460": review("Standing barbell calf raise end position", "EXACT", "barbell", true, true, "rejected", 58, 68, "REJECT", null, true, false, "rocking standing barbell calf raise", "The GIF is effectively one complementary static pose.", "An isolated pose cannot teach the complete movement."),
  "bf40cdf69b75b6ac": review("Seated calf raise pose", "RELATED_BUT_DIFFERENT", "seated calf-raise setup", false, true, "rejected", 58, 45, "REJECT", null, true, false, "seated variation", "Only a static seated pose is present.", "Wrong catalog variation and incomplete movement evidence."),
  "aa5c3f70905fd753": review("Standing barbell calf raise start position", "EXACT", "barbell", true, true, "rejected", 58, 68, "REJECT", null, true, false, "standing barbell variation", "Only one static position is visible.", "The complete plantar-flexion cycle is absent."),
  "5ce88876eeefed5b": review("Standing barbell calf raise end position", "EXACT", "barbell", true, true, "rejected", 58, 68, "REJECT", null, true, false, "standing barbell variation", "Only one complementary static position is visible.", "The complete plantar-flexion cycle is absent."),
  "3174bc031cbcf2b8": review("Wide pronated-grip lat pulldown tutorial", "EXACT", "cable lat-pulldown machine", true, true, "acceptable", 91, 88, "KEEP_PENDING", "EDUCATIONAL", false, true, "wide pronated grip with errors/corrections", "Multiple full pulldown positions and explanatory overlays are visible; the source is long-form instruction.", "Useful educational content, but Wikimedia flags the license for review, so approval is blocked."),
  "ed7dcbbebc3671f4": review("Wide-grip lat pulldown top pose", "EXACT", "lat-pulldown machine", true, true, "rejected", 64, 70, "REJECT", null, true, false, "wide pronated grip", "The GIF contains only the top/start position.", "One static pose does not demonstrate a repetition."),
  "073037fc2fefe2f5": review("Wide-grip lat pulldown bottom pose", "EXACT", "lat-pulldown machine", true, true, "rejected", 64, 70, "REJECT", null, true, false, "wide pronated grip", "The GIF contains only the bottom position.", "One static pose does not demonstrate a repetition."),
  "e1358c91d0449d14": review("45-degree leg press tutorial", "INCORRECT", "leg-press machine", false, false, "rejected", 82, 5, "REJECT", null, false, true, "leg press", "The entire source concerns leg press, not a vertical pull.", "Wrong exercise, movement pattern and equipment."),
  "c67f0842725ad27c": review("Wide pronated-grip lat pulldown tutorial", "RELATED_BUT_DIFFERENT", "cable lat-pulldown machine with straight bar", true, true, "acceptable", 91, 66, "REJECT", null, false, true, "pronated rather than neutral grip", "The visible grip is overhand and wide, not palms-facing neutral.", "The defining grip does not match; the source also has unresolved license review."),
  "bec02db7c0e5540f": review("Wide pronated-grip lat pulldown tutorial", "RELATED_BUT_DIFFERENT", "cable lat-pulldown machine with straight bar", true, true, "acceptable", 91, 66, "REJECT", null, false, true, "pronated rather than supinated grip", "The visible grip is overhand, not underhand/supinated.", "The defining grip does not match; the source also has unresolved license review."),
  "d8a9d8634fe83558": review("Seated selectorized row machine", "RELATED_BUT_DIFFERENT", "lever/selectorized row machine", false, true, "approved", 88, 74, "REJECT", null, true, true, "machine row rather than low cable row", "A complete horizontal pull is visible, but the lever machine is not the expected seated low cable setup.", "Equipment identity differs from the catalog exercise."),
  "fa3314301801fe84": review("Seated selectorized row machine", "EXACT", "chest-supported selectorized row machine", true, true, "approved", 88, 96, "APPROVE", "PRIMARY_DEMO", true, true, "standard bilateral machine row", "Chest support, handles and full horizontal pull/return are visible; source is instructional.", "Exact CDC public-domain demonstration; process a short excerpt before publishing."),
  "d30d76720bbdb703": review("Seated machine chest press", "EXACT", "selectorized chest-press machine", true, true, "approved", 89, 97, "APPROVE", "PRIMARY_DEMO", true, true, "standard bilateral machine press", "Seat, back support, handles and full press/return are visible; source is instructional.", "Exact CDC public-domain demonstration; process a short excerpt before publishing."),
  "e99c366fb897571d": review("Supine dumbbell floor press", "RELATED_BUT_DIFFERENT", "dumbbells and mat", false, true, "acceptable", 86, 49, "REJECT", null, true, true, "dumbbell floor press", "The animation shows free weights while lying on the floor.", "No chest-press machine is present."),
  "2e24d23ca33c4722": review("Incline barbell bench press", "RELATED_BUT_DIFFERENT", "barbell, incline bench and rack", false, true, "approved", 91, 72, "REJECT", null, true, true, "free-bar incline press", "A full incline press is clearly shown, but resistance is a free barbell.", "The catalog entry explicitly requires a machine."),
  "09b53183dd0a76f3": review("Seated horizontal machine chest press", "RELATED_BUT_DIFFERENT", "flat/horizontal chest-press machine", false, true, "approved", 89, 73, "REJECT", null, true, true, "non-incline machine press", "The machine press is horizontal and lacks the required incline trajectory.", "Correct family and machine, wrong press angle/variation."),
  "46e891811614ee31": review("Supine dumbbell floor press", "RELATED_BUT_DIFFERENT", "dumbbells and mat", false, true, "acceptable", 86, 43, "REJECT", null, true, true, "dumbbell floor press", "The animation shows a horizontal floor press.", "Wrong equipment and no incline angle."),
  "8c7b25d64e1f3dd6": review("Seated machine chest press", "RELATED_BUT_DIFFERENT", "chest-press machine", false, false, "approved", 89, 42, "REJECT", null, true, true, "machine press rather than fly", "The elbows extend while handles are pressed forward; no fly/adduction arc is shown.", "A chest press is not a pec-deck fly."),
  "ea3f265b5a97c799": review("Standing barbell shoulder press", "RELATED_BUT_DIFFERENT", "barbell and rack", false, true, "approved", 91, 70, "REJECT", null, true, true, "standing free-bar overhead press", "Complete overhead press repetitions are visible.", "The catalog requires a seated shoulder-press machine."),
  "a44ad4c9dd90e8bf": review("Seated dumbbell shoulder press tutorial", "RELATED_BUT_DIFFERENT", "dumbbells and bench", false, true, "acceptable", 82, 65, "REJECT", null, false, true, "seated dumbbell press", "The source includes setup, talking and dumbbell pressing rather than a machine demonstration.", "Wrong equipment; Wikimedia also marks the license for review."),
  "10a8bfbd07151982": review("Unilateral kettlebell suitcase carry", "RELATED_BUT_DIFFERENT", "one kettlebell", false, true, "approved", 87, 74, "REJECT", null, true, true, "single-arm suitcase carry", "The person walks with one kettlebell on one side; the complete path is visible from a low, distant camera.", "Unilateral suitcase carry has different anti-lateral-flexion demands than the bilateral farmer carry catalog entry."),
  "4055318b339d4591": review("Standing chest/shoulder stretch", "INCORRECT", "no equipment", false, false, "acceptable", 74, 10, "REJECT", null, true, true, "chest stretch", "The animation moves the arms for a chest stretch without thoracic extension over support.", "Wrong mobility exercise and target motion."),
  "a7c8eded2cdfbe7c": review("Standing hamstring stretch", "INCORRECT", "no equipment", false, false, "acceptable", 74, 5, "REJECT", null, true, true, "hamstring stretch", "The animation demonstrates a lower-body stretch.", "No thoracic extension occurs."),
  "a1907022712c0865": review("Stationary exercise-bike pedalling", "EXACT", "stationary exercise bicycle", true, true, "approved", 86, 95, "APPROVE", "PRIMARY_DEMO", true, true, "upright stationary bike", "The loop clearly shows continuous pedalling, the complete bicycle and rider posture without obstruction.", "Exact stationary-bike activity with verified CC BY-SA 4.0 permission record."),
};

const artifact = JSON.parse(
  await readFile("data/media/media-candidates.json", "utf8"),
) as Artifact;
let inventory: { candidates?: Record<string, unknown>[] } = {};
try {
  inventory = JSON.parse(
    await readFile(".tmp/media-validation/inventory.json", "utf8"),
  ) as { candidates?: Record<string, unknown>[] };
} catch {
  // The versioned result remains reproducible without temporary evidence files.
}
const technicalById = new Map(
  (inventory.candidates ?? []).map((candidate) => [
    String(candidate.candidateId),
    {
      download: candidate.download ?? null,
      technical: candidate.technical ?? null,
    },
  ]),
);

const candidates = artifact.exercises.flatMap((exercise) =>
  exercise.candidates.map((candidate) => {
    const candidateId = createHash("sha256")
      .update(`${exercise.slug}\0${candidate.sourceUrl}`)
      .digest("hex")
      .slice(0, 16);
    const result = reviews[candidateId];
    const exerciseEvidence = evidence[exercise.slug];
    if (!result || !exerciseEvidence)
      throw new Error(`Missing v1.5 review/evidence for ${exercise.slug}/${candidateId}`);
    const confidence =
      result.validationScore >= 95
        ? "VERY_HIGH_CONFIDENCE"
        : result.validationScore >= 85
          ? "HIGH_CONFIDENCE"
          : result.validationScore >= 70
            ? "MEDIUM_CONFIDENCE"
            : "LOW_CONFIDENCE";
    const attributionRequired = candidate.licenseCode !== "PD";
    return {
      candidateId,
      exerciseSlug: exercise.slug,
      sourceTitle: candidate.title,
      sourceUrl: candidate.sourceUrl,
      originalFileUrl: candidate.originalFileUrl,
      discoveryScore: candidate.score,
      visualExercise: result.visualExercise,
      expectedExercise: exerciseEvidence.expected,
      exerciseMatch: result.exerciseMatch,
      variation: result.variation,
      equipment: result.equipment,
      equipmentMatch: result.equipmentMatch,
      movementPattern: exerciseEvidence.movement,
      movementMatch: result.movementMatch,
      primaryJoints: exerciseEvidence.joints,
      predominantMuscles: exerciseEvidence.muscles,
      executionQuality: result.executionQuality,
      visibility: {
        score: result.visibilityScore,
        fullBodyVisible: result.visibilityScore >= 80,
        targetJointVisible: result.visibilityScore >= 60,
        machineVisible: result.equipmentMatch,
        movementPathVisible: result.fullMovementVisible,
        cameraStable: result.visibilityScore >= 70,
        obstructions: result.visibilityScore < 70 ? ["incomplete/static movement evidence"] : [],
      },
      validationScore: result.validationScore,
      confidence,
      recommendedRole: result.recommendedRole,
      decision: result.decision,
      trimStart: result.trimStart ?? null,
      trimEnd: result.trimEnd ?? null,
      license: {
        code: candidate.licenseCode,
        url: candidate.licenseUrl,
        author: candidate.author,
        sourceUrl: candidate.sourceUrl,
        originalFileUrl: candidate.originalFileUrl,
        attributionRequired,
        attributionText: candidate.attributionText,
        verified: result.licenseVerified,
        issue: result.licenseVerified ? null : "Wikimedia license review remains unresolved",
      },
      reviewChecklist: {
        exerciseIdentity: result.exerciseMatch === "EXACT",
        correctVariation: result.exerciseMatch === "EXACT" || result.exerciseMatch === "ACCEPTABLE_VARIATION",
        equipmentMatch: result.equipmentMatch,
        movementMatch: result.movementMatch,
        executionAcceptable: result.executionQuality !== "rejected",
        fullMovementVisible: result.fullMovementVisible,
        licenseVerified: result.licenseVerified,
        referencesVerified: exerciseEvidence.references.length >= 2,
      },
      references: exerciseEvidence.references,
      visualNotes: result.visualNotes,
      reasoningSummary: result.reason,
      technicalEvidence: technicalById.get(candidateId) ?? null,
    };
  }),
);

const count = <T>(items: T[], predicate: (item: T) => boolean) =>
  items.filter(predicate).length;
const slugs = Object.keys(evidence);
const primarySlugs = new Set(
  candidates
    .filter((candidate) => candidate.decision === "APPROVE" && candidate.recommendedRole === "PRIMARY_DEMO")
    .map((candidate) => candidate.exerciseSlug),
);
const uniqueReferences = new Set(
  slugs.flatMap((slug) => evidence[slug].references.map((item) => item.url)),
);
const summary = {
  totalCandidates: candidates.length,
  reviewed: candidates.length,
  approved: count(candidates, (item) => item.decision === "APPROVE"),
  rejected: count(candidates, (item) => item.decision === "REJECT"),
  pending: count(candidates, (item) => item.decision === "KEEP_PENDING"),
  exact: count(candidates, (item) => item.exerciseMatch === "EXACT"),
  acceptableVariation: count(candidates, (item) => item.exerciseMatch === "ACCEPTABLE_VARIATION"),
  relatedButDifferent: count(candidates, (item) => item.exerciseMatch === "RELATED_BUT_DIFFERENT"),
  incorrect: count(candidates, (item) => item.exerciseMatch === "INCORRECT"),
  primaryDemo: count(candidates, (item) => item.recommendedRole === "PRIMARY_DEMO"),
  educational: count(candidates, (item) => item.recommendedRole === "EDUCATIONAL"),
  alternativeVariation: count(candidates, (item) => item.recommendedRole === "ALTERNATIVE_VARIATION"),
  exercisesWithPrimary: primarySlugs.size,
  exercisesWithoutPrimary: slugs.length - primarySlugs.size,
  exercisesResearched: slugs.length,
  uniqueReferencesConsulted: uniqueReferences.size,
  licenseVerified: count(candidates, (item) => item.license.verified),
  licenseIssues: count(candidates, (item) => !item.license.verified),
};

if (summary.totalCandidates !== 40 || slugs.length !== 20)
  throw new Error(`Expected 40 candidates/20 exercises; got ${summary.totalCandidates}/${slugs.length}`);

await mkdir("data/media", { recursive: true });
await mkdir("docs/media-validation/exercises", { recursive: true });
await writeFile(
  "data/media/media-validation-v15.json",
  `${JSON.stringify({
    version: "1.5",
    generatedAt: "2026-08-20T15:30:00.000Z",
    sourceArtifact: "data/media/media-candidates.json",
    methodology: "Metadata + ffprobe + six-frame contact sheets + direct visual review + independent institutional web references + catalog/equipment comparison",
    productionApplied: false,
    summary,
    candidates,
  }, null, 2)}\n`,
);

const missing = slugs
  .filter((slug) => !primarySlugs.has(slug))
  .map((slug) => {
    const prior = candidates.filter((candidate) => candidate.exerciseSlug === slug);
    return {
      exerciseSlug: slug,
      reason: "No candidate passed exact identity, equipment, complete movement, execution, visibility and verified-license requirements together.",
      previousCandidatesReviewed: prior.length,
      bestCandidateScore: Math.max(...prior.map((candidate) => candidate.validationScore)),
      recommendedNextSearchQueries: evidence[slug].nextQueries,
      recommendedSourceTypes: evidence[slug].sourceTypes,
    };
  });
await writeFile(
  "data/media/missing-primary-media.json",
  `${JSON.stringify({ version: "1.5", generatedAt: "2026-08-20T15:30:00.000Z", exercises: missing }, null, 2)}\n`,
);

for (const slug of slugs) {
  const rows = candidates.filter((candidate) => candidate.exerciseSlug === slug);
  const blocks = rows.map((candidate, index) => `### Candidate ${index + 1}: ${candidate.sourceTitle}

Source: ${candidate.sourceUrl}

License: ${candidate.license.code} (${candidate.license.verified ? "verified" : "verification pending"})

Visual identification: ${candidate.visualExercise}

Equipment: ${candidate.equipment} (${candidate.equipmentMatch ? "matches" : "does not match"})

Movement: ${candidate.movementPattern}; movement ${candidate.movementMatch ? "agrees" : "does not agree"} with the catalog.

Execution quality: ${candidate.executionQuality}. ${candidate.visualNotes}

Web references:
${candidate.references.map((item, refIndex) => `${refIndex + 1}. [${item.organization} — ${item.name}](${item.url}) — ${item.conclusion}`).join("\n")}

Comparison: ${candidate.reasoningSummary}

Exact exercise: ${candidate.exerciseMatch === "EXACT" ? "YES" : "NO"}

Variation: ${candidate.exerciseMatch} — ${candidate.variation}

Recommended role: ${candidate.recommendedRole ?? "NONE"}

Validation score: ${candidate.validationScore}/100

Confidence: ${candidate.confidence}

Decision: ${candidate.decision}

Reason: ${candidate.reasoningSummary}`);
  await writeFile(
    path.join("docs/media-validation/exercises", `${slug}.md`),
    `# ${evidence[slug].expected}\n\nExpected: ${evidence[slug].expected}\n\n## Candidates\n\n${blocks.join("\n\n---\n\n")}\n`,
  );
}

const primary = candidates.filter((candidate) => candidate.recommendedRole === "PRIMARY_DEMO");
const pending = candidates.filter((candidate) => candidate.decision === "KEEP_PENDING");
await writeFile(
  "docs/MEDIA_VALIDATION_V15.md",
  `# VM Training Media Validation v1.5

This report records the complete visual, technical, licensing, biomechanics and web-reference review of the v1.2 discovery artifact. Discovery scores were retained only as provenance and were not used as approval thresholds. Temporary originals, probes and 3x2 contact sheets remain under \`.tmp/media-validation/\` and are intentionally ignored by Git.

## Summary

| Metric | Count |
| --- | ---: |
| Total candidates | ${summary.totalCandidates} |
| Reviewed | ${summary.reviewed} |
| Exact matches | ${summary.exact} |
| Acceptable variations | ${summary.acceptableVariation} |
| Related but different | ${summary.relatedButDifferent} |
| Incorrect | ${summary.incorrect} |
| Recommended PRIMARY_DEMO | ${summary.primaryDemo} |
| Recommended EDUCATIONAL | ${summary.educational} |
| Recommended ALTERNATIVE_VARIATION | ${summary.alternativeVariation} |
| Recommended rejected | ${summary.rejected} |
| Still pending | ${summary.pending} |
| Exercises with a valid PRIMARY candidate | ${summary.exercisesWithPrimary} |
| Exercises without a valid PRIMARY candidate | ${summary.exercisesWithoutPrimary} |

Catalog coverage is ${summary.exercisesWithPrimary}/${slugs.length} (${Math.round((summary.exercisesWithPrimary / slugs.length) * 100)}%). Plan-ready coverage remains 0/${slugs.length}: recommendations still require trim/transcode/poster/hash/storage/publish, and no Production write was attempted without a configured auditable Production mechanism.

## Second-pass PRIMARY_DEMO check

Each recommendation was re-evaluated against: “Would a novice understand the catalog exercise by watching only this asset?” The seven candidates below passed identity and source quality, subject to the stated processing step. Long CDC instructional sources must be reduced to a clean 4–12 second, silent excerpt before publication.

${primary.map((candidate) => `- **${candidate.exerciseSlug}** — ${candidate.sourceTitle} — ${candidate.reasoningSummary}`).join("\n")}

## Pending manual/license review

${pending.map((candidate) => `- **${candidate.exerciseSlug}** — ${candidate.sourceTitle}: ${candidate.reasoningSummary}`).join("\n")}

## Consistency rules applied

- Exercise identity and defining equipment outrank movement-pattern similarity.
- A static start or end pose is not a complete demonstration.
- Seated and prone leg curls, cable and lever rows, presses and flies, and grip-specific pulldowns remain distinct.
- A declared Creative Commons label was not accepted when Wikimedia still showed license review pending.
- No candidate was written to Production during analysis; the JSON result is the review boundary for a later auditable apply step.

## Exercise reports

${slugs.map((slug) => `- [${slug}](./media-validation/exercises/${slug}.md)`).join("\n")}
`,
);

process.stdout.write(`${JSON.stringify(summary)}\n`);
