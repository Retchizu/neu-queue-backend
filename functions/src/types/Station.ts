import { Timestamp } from "firebase-admin/firestore";
import Purpose from "@/types/purpose";

type Station = {
    id?: string; // Document ID (auto-generated)
    name: string; // Station name (e.g., "Tuition Payment")
    type: Purpose; // Purpose ID reference (deprecated, use purposes collection)
    description: string; // Optional description
    createdAt: Timestamp; // Creation timestamp
    updatedAt: Timestamp; // Last update timestamp
};

export default Station;
