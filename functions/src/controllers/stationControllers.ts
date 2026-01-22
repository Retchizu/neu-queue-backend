import { Request, Response } from "express";
import { stationSchema } from "@/zod-schemas/station-schema";
import { auth, firestoreDb } from "@/config/firebaseConfig";
import Station from "@/types/station";
import { recordLog } from "@/utils/recordLog";
import { ActionType } from "@/types/activity-log";
import { ZodError } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const addStation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const parsedBody = stationSchema.parse(req.body);
    const { name, description, type } = parsedBody;

    const stationRef = firestoreDb.collection("stations");
    const stationSnapshot = await stationRef.get();

    const doesStationExists = stationSnapshot.docs.some(
      (station) =>
        (station.data() as Station).name.toLowerCase() === name.toLowerCase()
    );

    if (doesStationExists) {
      res.status(409).json({ message: `Station with ${name} already exists.` });
      return;
    }

    await stationRef.doc().set({
      name: name,
      description: description,
      type: type,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const user = await auth.getUser(req.user!.uid);
    const displayName = user.displayName;

    await recordLog(
      user.uid,
      ActionType.ADD_STATION,
      `${displayName} Added station ${name}`
    );
    res.status(201).json({
      message: "Station added successfully.",
      station: {
        id: stationRef.id,
        ...parsedBody,
      },
    });
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ message: error.errors.map((err) => err.message).join(", ") });
      return;
    } else {
      res.status(500).json({ message: (error as Error).message });
      return;
    }
  }
};

export const getStations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 10;
    const cursor = req.query.cursor as string;

    let stationRef = firestoreDb
      .collection("stations")
      .orderBy("name", "asc")
      .limit(limit);

    if (cursor) {
      const lastDoc = await firestoreDb
        .collection("stations")
        .doc(cursor)
        .get();
      if (lastDoc.exists) {
        stationRef = stationRef.startAfter(lastDoc);
      }
    }
    const stationsSnapshot = await stationRef.get();
    const stations: Station[] = stationsSnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Station)
    );

    const nextCursor =
      stationsSnapshot.docs.length > 0
        ? stationsSnapshot.docs[stationsSnapshot.docs.length - 1].id
        : null;

    res.status(200).json({
      stations,
      nextCursor,
    });
    return;
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
    return;
  }
};

export const getStation = async (req: Request, res: Response) => {
  try {
    const { stationId } = req.params;
    const stationRef = firestoreDb.collection("station").doc(stationId);
    const stationSnapshot = await stationRef.get();

    if (!stationSnapshot.exists) {
      res.status(404).json({ message: "Station not found" });
      return;
    }
    const station: Station = {
      id: stationSnapshot.id,
      ...stationSnapshot.data(),
    } as Station;

    res.status(200).json({ station });
    return;
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
    return;
  }
};

export const updateStation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { stationId } = req.params;
    const parsedBody = stationSchema.parse(req.body);
    const { name, description, type } = parsedBody;

    const stationRef = firestoreDb.collection("stations");
    const stationListSnapshot = await stationRef.get();

    const doesStationExists = stationListSnapshot.docs.some(
      (station) =>
        (station.data() as Station).name.toLowerCase() === name.toLowerCase() &&
        station.id !== stationId
    );

    if (doesStationExists) {
      res.status(409).json({ message: `Station with ${name} already exists.` });
      return;
    }

    const stationSnapshot = await stationRef.doc(stationId).get();
    if (!stationSnapshot.exists) {
      res.status(404).json({ message: "Station not found" });
      return;
    }

    const updateData: Partial<Station> = {
      updatedAt: FieldValue.serverTimestamp() as Timestamp,
    };

    if (parsedBody.name !== undefined) {
      updateData.name = name;
    }
    if (parsedBody.type !== undefined) {
      updateData.type = type;
    }
    if (parsedBody.description !== undefined) {
      updateData.description = description;
    }

    await stationRef.doc(stationId).update(updateData);

    const user = await auth.getUser(req.user!.uid);
    const displayName = user.displayName;

    await recordLog(
      user.uid,
      ActionType.EDIT_STATION,
      `${displayName} updates station ${name}`
    );

    const updatedStationSnapshot = await stationRef.doc(stationId).get();
    const station: Station = {
      id: updatedStationSnapshot.id,
      ...updatedStationSnapshot.data(),
    } as Station;

    res.status(200).json({ station });
    return;
  } catch (error) {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ message: error.errors.map((err) => err.message).join(", ") });
      return;
    } else {
      res.status(500).json({ message: (error as Error).message });
      return;
    }
  }
};

export const deleteStation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { stationId } = req.params;
    const stationRef = firestoreDb.collection("stations").doc(stationId);
    const stationSnapshot = await stationRef.get();

    if (!stationSnapshot.exists) {
      res.status(404).json({ message: "Station not found" });
      return;
    }
    const station = stationSnapshot.data();

    const countersRef = firestoreDb.collection("counters");
    const countersSnapshot = await countersRef
      .where("stationId", "==", stationId)
      .get();

    const hasActiveCounter = countersSnapshot.docs.some((counterDoc) => {
      const counterData = counterDoc.data();
      return (
        counterData.cashierUid !== null && counterData.cashierUid !== undefined
      );
    });

    if (hasActiveCounter) {
      res.status(409).json({
        message:
          "Cannot delete station. There are active counters with assigned cashiers.",
      });
      return;
    }

    await stationRef.delete();

    const user = await auth.getUser(req.user!.uid);
    const displayName = user.displayName;

    await recordLog(
      user.uid,
      ActionType.DELETE_STATION,
      `${displayName} deletes station ${station!.name}`
    );
    res.status(200).json({
      message: `${station} has been deleted successfully`,
    });
    return;
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
    return;
  }
};

export const getAssignedStation = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized request" });
      return;
    }

    const cashierRef = firestoreDb.collection("cashiers").doc(req.user.uid);
    const cashierDoc = await cashierRef.get();

    if (!cashierDoc.exists) {
      res.status(404).json({ message: "Cashier not found" });
      return;
    }

    const cashierData = cashierDoc.data();
    const stationId = cashierData?.stationId || cashierData?.station || "";

    res.status(200).json({
      stationId: stationId || "",
    });
    return;
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
    return;
  }
};
