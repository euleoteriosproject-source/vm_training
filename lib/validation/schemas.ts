import { z } from "zod";

export const allowedEmails = [
  "vinicius.euleoterio@hotmail.com",
  "lisepaiva@hotmail.com",
] as const;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("E-mail inválido");
export const passwordSchema = z
  .string()
  .min(8, "Use ao menos 8 caracteres")
  .max(72);
export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export const signUpSchema = signInSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem",
  });

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  birthDate: z.iso.date(),
  heightCm: z.coerce.number().min(100).max(250),
  weightKg: z.coerce.number().min(30).max(400),
  goals: z.array(z.string()).min(1),
  sessionsPerWeek: z.coerce.number().int().min(2).max(5),
  sessionMinutes: z.coerce
    .number()
    .refine((v) => [30, 45, 60, 75, 90].includes(v)),
  cardioPreference: z.coerce.number().int().min(1).max(5),
  experience: z.enum(["beginner", "returning", "intermediate", "advanced"]),
  trainingLocation: z.enum(["full_gym", "small_gym", "condo", "home", "other"]),
  equipmentIds: z.array(z.string()).default([]),
});

export const setLogSchema = z.object({
  id: z.uuid().optional(),
  sessionExerciseId: z.uuid(),
  setNumber: z.number().int().positive(),
  weightKg: z.number().min(0).max(1000).nullable(),
  reps: z.number().int().min(0).max(1000).nullable(),
  durationSeconds: z.number().int().min(0).nullable(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  completed: z.boolean(),
});

export const measurementSchema = z.object({
  measuredAt: z.iso.datetime(),
  weightKg: z.number().min(30).max(400),
  waistCm: z.number().min(30).max(300).nullable().optional(),
  hipsCm: z.number().min(30).max(300).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  clothingFit: z
    .enum(["tighter", "same", "looser", "much_looser"])
    .nullable()
    .optional(),
});
