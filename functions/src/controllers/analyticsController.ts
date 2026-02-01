/* eslint-disable valid-jsdoc */
import { Request, Response } from "express";
import { firestoreDb } from "../config/firebaseConfig";
import { Timestamp } from "firebase-admin/firestore";
import type {
  StationsThroughputResponse,
  StationsWaitTimeResponse,
} from "../types/analytics";

/** Number of recent served entries to use when calculating average wait time (when no date range) */
const RECENT_SERVED_LIMIT = 50;

/** Min wait time in minutes to include (filter instant/errors) */
const MIN_WAIT_MINUTES = 0.17; // ~10 seconds

/** Max wait time in minutes to include (filter outliers) */
const MAX_WAIT_MINUTES = 240; // 4 hours

type DateRange = {
  startTimestamp: number;
  endTimestamp: number;
} | null;

/**
 * Calculates average actual wait time (createdAt → servedAt) per station.
 * Uses served queue entries (status: completed or serving).
 * Optional dateRange filters by servedAt within the range.
 */
async function getAverageWaitTimeForStation(
  stationId: string,
  dateRange: DateRange
): Promise<{ averageWaitTimeMinutes: number; sampleCount: number }> {
  let query = firestoreDb
    .collection("queue")
    .where("stationId", "==", stationId)
    .where("status", "in", ["completed", "serving"]);

  if (dateRange) {
    const startTs = Timestamp.fromMillis(dateRange.startTimestamp);
    const endTs = Timestamp.fromMillis(dateRange.endTimestamp);
    query = query
      .where("servedAt", ">=", startTs)
      .where("servedAt", "<=", endTs)
      .orderBy("servedAt", "desc");
  } else {
    query = query.orderBy("servedAt", "desc").limit(RECENT_SERVED_LIMIT);
  }

  const servedSnapshot = await query.get();

  const waitTimesMinutes: number[] = [];

  for (const doc of servedSnapshot.docs) {
    const data = doc.data();
    const createdAt = data.createdAt as Timestamp | undefined;
    const servedAt = data.servedAt as Timestamp | undefined;

    if (createdAt?.toMillis && servedAt?.toMillis) {
      const waitMs = servedAt.toMillis() - createdAt.toMillis();
      const waitMinutes = waitMs / (60 * 1000);
      if (waitMinutes >= MIN_WAIT_MINUTES && waitMinutes <= MAX_WAIT_MINUTES) {
        waitTimesMinutes.push(waitMinutes);
      }
    }
  }

  if (waitTimesMinutes.length === 0) {
    return { averageWaitTimeMinutes: 0, sampleCount: 0 };
  }

  const sum = waitTimesMinutes.reduce((a, b) => a + b, 0);
  const averageWaitTimeMinutes = Math.round((sum / waitTimesMinutes.length) * 10) / 10;

  return { averageWaitTimeMinutes, sampleCount: waitTimesMinutes.length };
}

/**
 * GET /analytics/average-wait-time
 * Returns average actual wait time per station. Object keyed by stationId.
 * Query params:
 *   - startDate, endDate (optional): ISO date strings for servedAt range. Both required if using date filter.
 * Access: superAdmin, admin
 */
export const getAverageWaitTime = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    let dateRange: DateRange = null;
    if (startDate && endDate && typeof startDate === "string" && typeof endDate === "string") {
      const startTimestamp = new Date(startDate).getTime();
      const endTimestamp = new Date(endDate).getTime();

      if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
        res.status(400).json({
          message: "Invalid date format. Use ISO date strings.",
        });
        return;
      }

      dateRange = { startTimestamp, endTimestamp };
    }

    const stationsSnapshot = await firestoreDb
      .collection("stations")
      .get();

    const response: StationsWaitTimeResponse = {};

    await Promise.all(
      stationsSnapshot.docs.map(async (doc) => {
        const result = await getAverageWaitTimeForStation(doc.id, dateRange);
        const stationName = (doc.data()?.name as string) ?? "";
        response[doc.id] = { stationName, ...result };
      })
    );

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      message: (error as Error).message,
    });
  }
};

/**
 * Counts completed services for a station within a date range.
 * Uses completedAt for filtering.
 */
async function getCompletedThroughputForStation(
  stationId: string,
  dateRange: DateRange
): Promise<number> {
  if (!dateRange) return 0;

  const startTs = Timestamp.fromMillis(dateRange.startTimestamp);
  const endTs = Timestamp.fromMillis(dateRange.endTimestamp);

  const snapshot = await firestoreDb
    .collection("queue")
    .where("stationId", "==", stationId)
    .where("status", "==", "completed")
    .where("completedAt", ">=", startTs)
    .where("completedAt", "<=", endTs)
    .orderBy("completedAt", "asc")
    .get();

  return snapshot.size;
}

/**
 * GET /analytics/completed-throughput
 * Returns number of completed services per station. Object keyed by stationId.
 * Query params:
 *   - startDate, endDate (required): ISO date strings for completedAt range.
 * Access: superAdmin, admin
 */
export const getCompletedThroughput = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate || typeof startDate !== "string" || typeof endDate !== "string") {
      res.status(400).json({
        message: "Missing startDate or endDate query parameters",
      });
      return;
    }

    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();

    if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
      res.status(400).json({
        message: "Invalid date format. Use ISO date strings.",
      });
      return;
    }

    const dateRange: DateRange = { startTimestamp, endTimestamp };

    const stationsSnapshot = await firestoreDb
      .collection("stations")
      .get();

    const response: StationsThroughputResponse = {};

    await Promise.all(
      stationsSnapshot.docs.map(async (doc) => {
        const completedCount = await getCompletedThroughputForStation(
          doc.id,
          dateRange
        );
        const stationName = (doc.data()?.name as string) ?? "";
        response[doc.id] = { stationName, completedCount };
      })
    );

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      message: (error as Error).message,
    });
  }
};
