import { object, string, enum as zEnum } from "zod";

export const joinQueueSchema = object({
  purpose: zEnum(["payment", "auditing", "clinic", "registrar"]).default(
    "payment"
  ),
  email: string().email("Invalid email format"),
  stationId: string().min(1, "Station ID can not be empty"),
  qrId: string().min(1, "Qr Id can not be empty"),
});
