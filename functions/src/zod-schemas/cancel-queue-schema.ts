import { object, string } from "zod";

export const cancelQueueSchema = object({
  reason: string().optional(),
});
