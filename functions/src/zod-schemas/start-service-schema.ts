import { object, string } from "zod";

export const startServiceSchema = object({
  counterId: string().min(1, "Counter ID cannot be empty"),
});
