import { object, string, enum as zEnum} from "zod";

export const stationSchema = object({
  name: string().min(1, "Name is required"),
  description: string().min(1, "Description is required"),
  type: zEnum(["payment", "auditing", "clinic", "registrar"]).default("payment"),
});
