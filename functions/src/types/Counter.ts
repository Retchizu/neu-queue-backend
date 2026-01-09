import { Timestamp } from "firebase-admin/firestore";

type Counter = {
    id?: string; // Document ID (auto-generated)
    number: number; // Counter number (e.g., "Counter 1")
    stationId: string; // Reference to stations collection
    cashierUid?: string
    createdAt: Timestamp; // Creation timestamp
    updatedAt: Timestamp; // Last update timestamp
};

export default Counter;
