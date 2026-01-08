import Purpose from "@/types/purpose";
import { Timestamp } from "firebase-admin/firestore";
import { QueueStatus } from "@/types/queue-status";

export type Queue = {
    id: string; // Document ID (auto-generated)
    stationId: string; // Reference to stations collection
    counterId?: string; // Reference to counters collection (assigned when service starts)
    purpose: Purpose; // Purpose of the queue entry
    customerId: string; // Reference to users collection (customer)
    customerEmail: string; // Customer email (denormalized for quick access)
    status: QueueStatus; // Current queue status
    position: number; // Position in queue (1-based)
    estimatedWaitTime?: number; // Estimated wait time in minutes
    token?: string; // Short-lived access token for customer session
    tokenExpiresAt?: Timestamp; // Token expiration timestamp
    createdAt: Timestamp; // Queue entry creation timestamp
    servedAt?: Timestamp; // When service started
    completedAt?: Timestamp; // When service completed
    cancelledAt?: Timestamp; // When queue entry was cancelled
    cancelledBy?: string; // User ID who cancelled (customer or cashier)
};
