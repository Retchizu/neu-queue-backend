import { Request, Response } from "express";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import QRcode from "qrcode";
import { firestoreDb, realtimeDb } from "../config/firebaseConfig";
import { addToQueueSchema } from "../zod-schemas/addToQueue";
import { v4 as uuidv4 } from "uuid";
import CashierType from "../types/purpose";
import Counter from "../types/counter";
import { sendNotification } from "../utils/sendNotification";
import Customer from "../types/Customer";
import { sendEmail } from "../utils/sendEmail";
import { recordLog } from "../utils/recordLog";
import { ActionType } from "../types/activityLog";
import { ZodError } from "zod";
import { QrCodeDocument } from "@/types/qrcode";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import redisClient from "@/config/redisClient";

const SECRET_KEY = process.env.JWT_SECRET;
const NEUQUEUE_ROOT_URL = process.env.NEUQUEUE_ROOT_URL;

export const generateQrCode = async (req: Request, res: Response) => {
  try {
    if (!SECRET_KEY || !NEUQUEUE_ROOT_URL) {
      throw new Error("Missing Secret in environmental variables!");
    }

    const qrId = uuidv4();
    const qrPayload: QrCodeDocument = {
      createdAt: FieldValue.serverTimestamp() as Timestamp,
      expiresAt: new Date(Date.now() + 5 * 60),
      isUsed: false,
      type: "form",
      createdBy: req.user!.uid,
    };

    const url = `${NEUQUEUE_ROOT_URL}?qr_id=${qrId}`;
    const qrCodeDataUrl = await QRcode.toDataURL(url);

    await redisClient.set(qrId, JSON.stringify(qrPayload), {
      expiration: {
        type: "EX",
        value: 5 * 60,
      },
    });


    return res.status(201).json({ qrCodeDataUrl, qrId });
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return res.status(401).json({ message: "Token has expired, please sign in again" });
    } else {
      return res.status(500).json({ message: (error as Error).message });
    }
  }
};

export const getQueueAccess = async (req: Request, res: Response ) => {
  const { initialQrId } = req.query;

  const initialQrData = await redisClient.get((initialQrId as string));
  if (!initialQrData) {
    return res.status(403).send("Invalid or expired QR template");
  }
  const data = JSON.parse(initialQrData);

  // Generate dynamic QR ID
  const formSessionId = uuidv4();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  await firestoreDb.collection("form_session").doc(formSessionId).set({
    used: false,
    type: data.type,
    issuedAt: Date.now(),
    expiresAt,
  });

  // create session and redirect
  res.cookie("session", formSessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 5 * 60 * 1000,
  });

  return res.redirect(data.type === "queue" ? "/queue" : "/form");
};

