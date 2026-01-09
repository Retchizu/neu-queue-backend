import { Request, Response } from "express";
import { counterSchema } from "@/zod-schemas/counter-schema";
import { auth, firestoreDb } from "../config/firebaseConfig";
import { recordLog } from "../utils/recordLog";
import { ActionType } from "../types/activity-log";
import { ZodError } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import Counter from "@/types/counter";

export const addCounter = async (req: Request, res: Response): Promise<void> => {
  try {
    const {stationId, number} = counterSchema.parse(req.body);

    // check if station is existing
    const stationRef = firestoreDb.collection("stations").doc(stationId);
    const stationSnapshot = await stationRef.get();

    if (!stationSnapshot.exists) {
      res.status(404).json({ message: "Station not found."});
      return;
    }

    const counterRef = firestoreDb.collection("counters").doc();
    const counter: Counter = {
      number: number,
      stationId: stationId,
      createdAt: FieldValue.serverTimestamp() as Timestamp,
      updatedAt: FieldValue.serverTimestamp() as Timestamp,
    };

    await counterRef.set(counter);

    counter.id = stationRef.id;

    const user = await auth.getUser(req.user!.uid);
    const displayName = user.displayName;

    await recordLog(
      user.uid,
      ActionType.ADD_COUNTER,
      `${displayName} added counter: ${number} in ${stationSnapshot.data()!.name}`
    );

    res.status(201).json({ message: "Counter added Successfully", counter });
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: error.errors.map((err) => err.message).join(", ") });
      return;
    } else {
      res.status(500).json({ message: (error as Error).message });
      return;
    }
  }
};

export const getCounters = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 10;
    const {stationId, cursor} = req.query;

    if (!stationId) {
      res.status(404).json({ message: "Station not found."});
      return;
    }

    let counterRef = firestoreDb.collection("counters").orderBy("number", "asc").limit(limit);

    if (cursor) {
      const lastDoc = await firestoreDb.collection("counters").doc((cursor as string)).get();
      if (lastDoc.exists) {
        counterRef = counterRef.startAfter(cursor);
      }
    }

    const counterSnapshot = await counterRef.get();
    const counters: Counter[] = counterSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }) as Counter);

    const snapshotLength = counterSnapshot.docs.length;
    const nextCursor = snapshotLength > 0 ? counterSnapshot.docs[snapshotLength - 1].id : null;
    res.status(200).json({ counters, nextCursor });
    return;
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
    return;
  }
};

export const updateCounter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { counterId } = req.params;
    if (!counterId) {
      res.status(400).json({ message: "Missing counter Id" });
      return;
    }
    const parsedBody = counterSchema.parse(req.body);
    const { number, stationId, cashierUid} = parsedBody;

    if (cashierUid) {
      res.status(409).json({ message: "Can not update an active counter"});
      return;
    }

    const stationRef = firestoreDb.collection("stations").doc(stationId);
    const stationSnapshot = await stationRef.get();

    if (!stationSnapshot.exists) {
      res.status(404).json({ message: "Station not found."});
      return;
    }
    const counterRef = firestoreDb.collection("counters").doc(counterId);
    const counterSnapshot = await counterRef.get();
    if (!counterSnapshot.exists) {
      res.status(404).json({ message: "Counter not found" });
      return;
    }

    const doesCounterBelongToStation = stationSnapshot.data()!.id === counterSnapshot.data()!.stationId;

    if (!doesCounterBelongToStation) {
      res.status(400).json({ message: "Station and Counter mismatch."});
      return;
    }

    const updateData: Partial<Counter> = {
      updatedAt: FieldValue.serverTimestamp() as Timestamp,
    };

    if (number !== undefined) {
      updateData.number = number;
    }

    await counterRef.update(updateData);

    const updatedSnapshot = await counterRef.get();

    const user = await auth.getUser(req.user!.uid);
    const displayName = user.displayName;
    await recordLog(
      user.uid,
      ActionType.EDIT_COUNTER,
      `${displayName} updates counter ${counterSnapshot.data()!.number} from station ${stationSnapshot.data()!.name}`
    );

    const counter: Counter = {
      id: counterRef.id,
      number: updateData.number || number,
      stationId: updatedSnapshot.data()!.stationId as string,
      cashierUid: updatedSnapshot.data()!.cashierUid as string || undefined,
      createdAt: updatedSnapshot.data()!.createdAt,
      updatedAt: updateData.updatedAt!,
    };

    res.status(200).json({
      message: `${counterSnapshot.data()!.number} has been updated to ${
        updatedSnapshot.data()!.number
      }`,
      counter,
    });
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: error.errors.map((err) => err.message).join(", ") });
      return;
    } else {
      res.status(500).json({ message: (error as Error).message });
      return;
    }
  }
};


export const deleteCounter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { counterId } = req.params;
    const {stationId, cashierUid} = counterSchema.parse(req.body);

    if (cashierUid) {
      res.status(409).json({ message: "Can not delete an active counter."});
      return;
    }

    if (!counterId) {
      res.status(400).json({ message: "Missing counter Id" });
      return;
    }

    const counterRef = firestoreDb.collection("counters").doc(counterId);
    const counterSnapshot = await counterRef.get();
    if (!counterSnapshot.exists) {
      res.status(404).json({ message: "Counter not found" });
      return;
    }

    await counterRef.delete();

    const stationRef = firestoreDb.collection("stations").doc(stationId);
    const stationSnapshot = await stationRef.get();

    const user = await auth.getUser(req.user!.uid);
    const displayName = user.displayName;
    await recordLog(
      user.uid,
      ActionType.DELETE_COUNTER,
      `${displayName} deleted counter ${counterSnapshot.data()!.number} from station ${stationSnapshot.data()!.name}`
    );
    res
      .status(200)
      .json({ message: `${counterSnapshot.data()!.number} has been removed` });
    return;
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
    return;
  }
};

export const enterCounter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { counterId } = req.params;

    if (!counterId) {
      res.status(400).json({ message: "Missing counter Id" });
      return;
    }

    const counterRef = firestoreDb.collection("counters").doc(counterId);
    const counterSnapshot = await counterRef.get();

    if (!counterSnapshot.exists) {
      res.status(404).json({ message: "Counter not found" });
      return;
    }

    const counterData = counterSnapshot.data() as Counter;

    // Check if counter is already occupied
    if (counterData.cashierUid) {
      res.status(409).json({ message: "Counter is already occupied" });
      return;
    }

    // Update counter with cashier UID
    await counterRef.update({
      cashierUid: req.user!.uid,
      updatedAt: FieldValue.serverTimestamp() as Timestamp,
    });

    const updatedSnapshot = await counterRef.get();
    const updatedCounter: Counter = {
      id: counterRef.id,
      ...updatedSnapshot.data(),
    } as Counter;

    // Get station info for logging
    const stationRef = firestoreDb.collection("stations").doc(counterData.stationId);
    const stationSnapshot = await stationRef.get();
    const stationName = stationSnapshot.exists ? stationSnapshot.data()!.name : "Unknown";

    const user = await auth.getUser(req.user!.uid);
    const displayName = user.displayName;

    await recordLog(
      user.uid,
      ActionType.EDIT_COUNTER,
      `${displayName} entered counter ${counterData.number} at station ${stationName}`
    );

    res.status(200).json({
      message: `Successfully entered counter ${counterData.number}`,
      counter: updatedCounter,
    });
    return;
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
    return;
  }
};

export const exitCounter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { counterId } = req.params;

    if (!counterId) {
      res.status(400).json({ message: "Missing counter Id" });
      return;
    }

    const counterRef = firestoreDb.collection("counters").doc(counterId);
    const counterSnapshot = await counterRef.get();

    if (!counterSnapshot.exists) {
      res.status(404).json({ message: "Counter not found" });
      return;
    }

    const counterData = counterSnapshot.data() as Counter;

    // Check if counter is currently occupied by the requesting cashier
    if (!counterData.cashierUid) {
      res.status(400).json({ message: "Counter is not currently occupied" });
      return;
    }

    // Check if the requesting user is the one occupying the counter
    if (counterData.cashierUid !== req.user!.uid) {
      res.status(403).json({ message: "You are not assigned to this counter" });
      return;
    }

    // Check if there are other active counters in the same station
    const activeCountersSnapshot = await firestoreDb
      .collection("counters")
      .where("stationId", "==", counterData.stationId)
      .where("cashierUid", "!=", null)
      .get();

    // Filter out the current counter from the active counters
    const otherActiveCounters = activeCountersSnapshot.docs.filter(
      (doc) => doc.id !== counterId && doc.data().cashierUid !== null
    );

    // Prevent exit if there are no other active counters in the station
    if (otherActiveCounters.length === 0) {
      res.status(409).json({
        message: "Cannot exit counter. There are no other active counters serving in this station.",
      });
      return;
    }

    // Update counter by removing cashier UID
    await counterRef.update({
      cashierUid: null,
      updatedAt: FieldValue.serverTimestamp() as Timestamp,
    });

    const updatedSnapshot = await counterRef.get();
    const updatedCounter: Counter = {
      id: counterRef.id,
      ...updatedSnapshot.data(),
    } as Counter;

    // Get station info for logging
    const stationRef = firestoreDb.collection("stations").doc(counterData.stationId);
    const stationSnapshot = await stationRef.get();
    const stationName = stationSnapshot.exists ? stationSnapshot.data()!.name : "Unknown";

    const user = await auth.getUser(req.user!.uid);
    const displayName = user.displayName;

    await recordLog(
      user.uid,
      ActionType.EDIT_COUNTER,
      `${displayName} exited counter ${counterData.number} at station ${stationName}`
    );

    res.status(200).json({
      message: `Successfully exited counter ${counterData.number}`,
      counter: updatedCounter,
    });
    return;
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
    return;
  }
};
