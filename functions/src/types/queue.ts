import Purpose from "./purpose";
import { Timestamp } from "firebase-admin/firestore";
import { QueueStatus } from "./queue-status";

export type Queue = {
    id: string; // Document ID (auto-generated)
    stationId: string; // Reference to stations collection
    counterId?: string; // Reference to counters collection (assigned when service starts)
    queueNumber: string;
    purpose: Purpose; // Purpose of the queue entry
    customerEmail: string; // Customer email (denormalized for quick access)
    status: QueueStatus; // Current queue status
    position: number; // Position in queue (1-based)
    estimatedWaitTime?: number; // Estimated wait time in minutes
    qrId?: string; // Short-lived id for customer session
    createdAt: Timestamp; // Queue entry creation timestamp
    servedAt?: Timestamp; // When service started
    servedBy?: string; // User ID of the cashier who started serving
    completedAt?: Timestamp; // When service completed
    cancelledAt?: Timestamp; // When queue entry was cancelled
    cancelledBy?: string; // User ID who cancelled (customer or cashier)
};
