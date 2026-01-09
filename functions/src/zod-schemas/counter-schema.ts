import { number, object, string } from "zod";

export const counterSchema = object({
  stationId: string().min(1, "stationId is required"),
  number: number().int().positive(),
  cashierUid: string().optional(),
});
