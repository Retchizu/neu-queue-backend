import { Timestamp } from "firebase-admin/firestore";
import { SessionType } from "./token-type";


export type QrCodeDocument = {
    id?: string; // UUID
    qrCodeImageUrl?: string;
    expiresAt: Date;
    usedAt?: Timestamp;
    type: SessionType;
    createdAt: Timestamp;
    createdBy: string;
};
