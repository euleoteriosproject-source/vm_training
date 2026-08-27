import { z } from "zod";
import type { ReplacementType } from "@/lib/workout/plan-swap";

export const sessionSwapReasonSchema = z.enum([
  "occupied_today",
  "equipment_missing",
  "exercise_dislike",
  "user_choice",
  "other",
]);

export const sessionSwapRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("replace"),
    replacementExerciseId: z.string().uuid(),
    replacementType: z.enum(["DIRECT_EQUIVALENT", "GOAL_ALIGNED_ALTERNATIVE"]),
    reasonCode: sessionSwapReasonSchema,
    equipmentId: z.string().uuid().nullable().default(null),
    persistChange: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("undo"),
    eventId: z.string().uuid(),
  }),
]);

export type SessionReplacementCandidate = {
  exerciseId: string;
  exerciseName: string;
  movementPattern: string;
  trainingRole: string;
  category: string;
  difficulty: string;
  primaryMuscles: string[];
  equipmentNames: string[];
  mediaUrl: string | null;
  posterUrl: string | null;
  mediaType: "gif" | "video";
  replacementType: Exclude<ReplacementType, "REQUIRES_REBALANCE">;
  reason: string;
  goalAlignmentReason: string;
  totalCount: number;
};
