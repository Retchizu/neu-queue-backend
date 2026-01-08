import { Timestamp } from "firebase-admin/firestore";
import { TokenType } from "@/types/token-type";

export type QrCodeDocument = {
    id?: string; // UUID
    qrCodeImageUrl?: string;
    expiresAt: Date;
    isUsed: boolean;
    usedAt?: Timestamp;
    type: TokenType;
    createdAt: Timestamp;
    createdBy: string;
};

export type RedisQrCode = {
    id?: string; // UUID
    qrCodeImageUrl?: string;
    expiresAt: Date;
    isUsed: boolean;
    usedAt?: Timestamp;
    type: TokenType;
    createdAt: Timestamp;
    createdBy: string;
};

