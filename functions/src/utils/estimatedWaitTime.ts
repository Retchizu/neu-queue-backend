import { firestoreDb } from "../config/firebaseConfig";
import { Timestamp } from "firebase-admin/firestore";

/** Default average service time in minutes when no historical data exists */
const DEFAULT_AVG_SERVICE_MINUTES = 5;

/** Number of recent completed services to use when calculating average */
const RECENT_COMPLETED_LIMIT = 20;

/**
 * Calculates the average service time (in minutes) for a station based on
 * recently completed queue entries. Uses servedAt and completedAt timestamps.
 * Returns a default value when no historical data exists.
 * @param {string} stationId - The station ID to calculate average service time for
 */
export async function getAverageServiceTimeMinutes(
    stationId: string
): Promise<number> {
    const completedSnapshot = await firestoreDb
        .collection("queue")
        .where("stationId", "==", stationId)
        .where("status", "==", "completed")
        .orderBy("completedAt", "desc")
        .limit(RECENT_COMPLETED_LIMIT)
        .get();

    const durations: number[] = [];

    for (const doc of completedSnapshot.docs) {
        const data = doc.data();
        const servedAt = data.servedAt as Timestamp | undefined;
        const completedAt = data.completedAt as Timestamp | undefined;

        if (servedAt?.toMillis && completedAt?.toMillis) {
            const durationMs = completedAt.toMillis() - servedAt.toMillis();
            const durationMinutes = durationMs / (60 * 1000);
            // Ignore outliers (e.g., < 10 seconds or > 2 hours)
            if (durationMinutes >= 0.17 && durationMinutes <= 120) {
                durations.push(durationMinutes);
            }
        }
    }

    if (durations.length === 0) {
        return DEFAULT_AVG_SERVICE_MINUTES;
    }

    const sum = durations.reduce((a, b) => a + b, 0);
    return sum / durations.length;
}

/**
 * Calculates estimated wait time (in minutes) for a customer joining the queue.
 * Based on: (people ahead) * (average service time per customer).
 * When multiple counters serve a station, effective throughput is higher;
 * we divide by active counter count when available for a more accurate estimate.
 * @param {string} stationId - The station ID for the queue
 * @param {number} position - The customer's position in the queue (1-based)
 */
export async function calculateEstimatedWaitTime(
    stationId: string,
    position: number
): Promise<number> {
    const peopleAhead = Math.max(0, position - 1);
    if (peopleAhead === 0) {
        return 0;
    }

    const avgServiceMinutes = await getAverageServiceTimeMinutes(stationId);

    // Get count of active counters (with cashier assigned) for this station
    const activeCountersSnapshot = await firestoreDb
        .collection("counters")
        .where("stationId", "==", stationId)
        .get();

    const activeCounterCount = activeCountersSnapshot.docs.filter(
        (doc) => doc.data().cashierUid != null
    ).length;

    const effectiveCounters = Math.max(1, activeCounterCount);
    const estimatedMinutes = (peopleAhead * avgServiceMinutes) / effectiveCounters;

    return Math.round(estimatedMinutes);
}

/**
 * Refreshes estimatedWaitTime for all waiting/serving queue entries at a station.
 * Call after a service completes so remaining customers get updated estimates.
 * @param {string} stationId - The station ID to refresh wait times for
 */
export async function refreshEstimatedWaitTimesForStation(
    stationId: string
): Promise<void> {
    const waitingSnapshot = await firestoreDb
        .collection("queue")
        .where("stationId", "==", stationId)
        .where("status", "in", ["waiting", "serving"])
        .orderBy("position", "asc")
        .get();

    if (waitingSnapshot.empty) return;

    const avgServiceMinutes = await getAverageServiceTimeMinutes(stationId);
    const activeCountersSnapshot = await firestoreDb
        .collection("counters")
        .where("stationId", "==", stationId)
        .get();
    const effectiveCounters = Math.max(
        1,
        activeCountersSnapshot.docs.filter(
            (doc) => doc.data().cashierUid != null
        ).length
    );

    const writeBatch = firestoreDb.batch();
    let peopleAhead = 0;

    for (const doc of waitingSnapshot.docs) {
        const estimatedMinutes =
            (peopleAhead * avgServiceMinutes) / effectiveCounters;
        const estimatedWaitTime = Math.round(estimatedMinutes);
        writeBatch.update(doc.ref, { estimatedWaitTime });
        peopleAhead += 1;
    }

    await writeBatch.commit();
}
