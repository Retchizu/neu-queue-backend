import { z } from "zod";

export const assignCashierSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  stationId: z.string().min(1, "Station ID is required"),
});
