import { z } from "zod";

export const asrSchema = z.object({
  expectedR: z.number().finite().min(-100).max(100).nullable(),
  valid: z.boolean().nullable(), asrComments: z.string().max(10000),
}).strict();
export type AsrFields = z.infer<typeof asrSchema>;
export interface AsrDocument { _id: string; revision: number; fields: AsrFields; updatedAt: string; basisFingerprint: string }
