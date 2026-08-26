import type { GymProfile } from "./types";

export const STANDARD_COMMERCIAL_GYM = "STANDARD_COMMERCIAL_GYM" as const;

export const gymProfileCapabilities: Record<GymProfile, readonly string[]> = {
  STANDARD_COMMERCIAL_GYM: [
    "free_weights",
    "bench",
    "cable_system",
    "vertical_pull",
    "horizontal_pull",
    "horizontal_push",
    "vertical_push",
    "squat_pattern_machine_or_free_weight",
    "leg_press",
    "knee_extension",
    "knee_flexion",
    "cardio_machine",
    "bodyweight",
  ],
  BASIC_GYM: [
    "free_weights",
    "bench",
    "cable_system",
    "squat_pattern_machine_or_free_weight",
    "cardio_machine",
    "bodyweight",
  ],
  HOME_GYM: ["free_weights", "bench", "bodyweight"],
  BODYWEIGHT_ONLY: ["bodyweight"],
};

export function capabilitiesForGym(profile: GymProfile) {
  return [...gymProfileCapabilities[profile]];
}

export function gymCategoryToProfile(category?: string | null): GymProfile {
  if (category === "academia_essencial") return "BASIC_GYM";
  if (category === "peso_livre_funcional") return "HOME_GYM";
  return STANDARD_COMMERCIAL_GYM;
}
