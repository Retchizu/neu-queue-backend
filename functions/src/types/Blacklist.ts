import { Timestamp } from "firebase-admin/firestore";

export type Blacklist = {
  id?: string;
  email: string;
  reason: string;
  blockedAt?: Timestamp;
  blockedBy?: string;
};
