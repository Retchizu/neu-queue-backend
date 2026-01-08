import { Request, Response } from "express";
import { counterSchema } from "@/zod-schemas/counterSchema";
import { auth, firestoreDb } from "../config/firebaseConfig";
import { recordLog } from "../utils/recordLog";
import { ActionType } from "../types/activityLog";
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
