export type QueueStatus =
    | "waiting" // Waiting in queue
    | "serving" // Currently being served
    | "completed" // Service completed
    | "cancelled" // Cancelled by customer or cashier
    | "no_show"; // Marked as no-show by cashier
