import { z } from "zod";

export const assignRoleSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.enum(["admin", "cashier", "information", "superAdmin", "pending"], {
    errorMap: () => ({ message: "Invalid role" }),
  }),
});
