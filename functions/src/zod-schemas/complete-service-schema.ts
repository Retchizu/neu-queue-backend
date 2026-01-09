import { object, string } from "zod";

export const completeServiceSchema = object({
  notes: string().optional(),
});
