import { Request, Response } from "express";
import QRcode from "qrcode";
import { firestoreDb } from "../config/firebaseConfig";
import { v4 as uuidv4 } from "uuid";
import { QrCodeDocument } from "@/types/qrcode";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import redisClient from "@/config/redisClient";
import { joinQueueSchema } from "@/zod-schemas/join-queue-schema";
import { startServiceSchema } from "@/zod-schemas/start-service-schema";
import { completeServiceSchema } from "@/zod-schemas/complete-service-schema";
import { cancelQueueSchema } from "@/zod-schemas/cancel-queue-schema";
import { ZodError } from "zod";
import { Queue } from "@/types/queue";

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

        res.status(201).json({ qrCodeDataUrl, qrId });
        return;
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
        return;
    }
};

export const getQueueAccess = async (req: Request, res: Response) => {
    const { initialQrId } = req.query;

    const initialQrData = await redisClient.get(initialQrId as string);
    if (!initialQrData) {
        res.status(403).send("Invalid or expired QR template");
        return;
    }
    const data = JSON.parse(initialQrData);

    // Generate dynamic QR ID
    const sessionId = uuidv4();
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000;

    await firestoreDb.collection("customer-sessions").doc(sessionId).set({
        type: data.type,
        issuedAt: Date.now(),
        expiresAt,
    });

    // create session and redirect
    res.cookie("session", sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 8 * 60 * 60 * 1000,
    });

    res.redirect(data.type === "queue" ? "/queue" : "/form");
    return;
};

export const joinQueue = async (req: Request, res: Response) => {
    try {
        const { email, purpose, stationId, qrId } = joinQueueSchema.parse(
            req.body
        );

        const stationDoc = await firestoreDb
            .collection("stations")
            .doc(stationId)
            .get();
        if (!stationDoc.exists) {
            res.status(404).json({ message: "Station not found." });
            return;
        }

        const stationData = stationDoc.data();
        if (stationData?.type !== purpose) {
            res.status(400).json({
                message:
                    `Purpose mismatch. Station type is "${stationData?.type}" ` +
                    `but provided purpose is "${purpose}".`,
            });
            return;
        }

        const queueRef = firestoreDb.collection("queue");
        const existingQueueRef = queueRef
            .where("stationId", "==", stationId)
            .where("customerEmail", "==", email.toLowerCase())
            .where("status", "in", ["waiting", "serving"]);
        const existingQueueSnapshot = await existingQueueRef.get();

        if (!existingQueueSnapshot.empty) {
            res.status(409).json({
                message:
                    "You are already in the queue, or try another email address",
            });
            return;
        }

        const customerSessionRef = firestoreDb
            .collection("customer-sessions")
            .doc(qrId);
        await customerSessionRef.update({ type: "queue" });

        const waitingQueueRef = queueRef
            .where("stationId", "==", stationId)
            .where("status", "in", ["waiting", "serving"]);
        const waitingQueueSnapshot = await waitingQueueRef.get();

        const queueLength = waitingQueueSnapshot.size;
        const position = queueLength + 1;

        // Generate queue number based on purpose and position
        const purposeAbbreviation: Record<string, string> = {
            payment: "PAY",
            clinic: "CLI",
            auditing: "AUD",
            registrar: "REG",
        };
        const abbreviation = purposeAbbreviation[purpose] || "QUE";
        const queueNumber = `${abbreviation}-${String(position).padStart(
            3,
            "0"
        )}`;

        await queueRef.doc().set({
            stationId,
            customerEmail: email,
            queueNumber,
            purpose,
            position,
            createdAt: FieldValue.serverTimestamp(),
            status: "waiting",
            qrId,
        });
        res.status(200).json({
            message: `${email} joins ${stationData.name} successfully.`,
            queueNumber,
            position,
        });
        res.redirect("/queue");
        return;
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                message: error.errors.map((err) => err.message).join(", "),
            });
            return;
        } else {
            res.status(500).json({ message: (error as Error).message });
            return;
        }
    }
};

export const getQueue = async (req: Request, res: Response) => {
    try {
        const { qrId, status } = req.query;

        if (!qrId) {
            res.status(400).json({ message: "qrId is required" });
            return;
        }

        const queueRef = firestoreDb
            .collection("queue")
            .where("qrId", "==", qrId);

        // If status is provided, filter by it
        const query = status ?
            queueRef.where("status", "==", status) :
            queueRef;

        const queueSnapshot = await query.get();

        if (queueSnapshot.empty) {
            res.status(404).json({ message: "Queue not found" });
            return;
        }

        // Get the first matching queue document
        const queueDoc = queueSnapshot.docs[0];
        const queueData = queueDoc.data();

        const queue: Queue = {
            id: queueDoc.id,
            stationId: queueData.stationId,
            counterId: queueData.counterId,
            queueNumber: queueData.queueNumber,
            purpose: queueData.purpose,
            customerEmail: queueData.customerEmail,
            status: queueData.status,
            position: queueData.position,
            estimatedWaitTime: queueData.estimatedWaitTime,
            qrId: queueData.qrId,
            createdAt: queueData.createdAt,
            servedAt: queueData.servedAt,
            servedBy: queueData.servedBy,
            completedAt: queueData.completedAt,
            cancelledAt: queueData.cancelledAt,
            cancelledBy: queueData.cancelledBy,
        };

        res.status(200).json(queue);
        return;
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
        return;
    }
};

export const getQueuesByStation = async (req: Request, res: Response) => {
    try {
        const { stationId } = req.params;
        const { status, limit: limitParam, cursor } = req.query;

        if (!stationId) {
            res.status(400).json({ message: "stationId is required" });
            return;
        }

        const limit = Number(limitParam) || 10;
        const cursorString = cursor as string;

        // Verify station exists
        const stationDoc = await firestoreDb
            .collection("stations")
            .doc(stationId)
            .get();

        if (!stationDoc.exists) {
            res.status(404).json({ message: "Station not found" });
            return;
        }

        // Build query for queues for the station
        let queueQuery = firestoreDb
            .collection("queue")
            .where("stationId", "==", stationId);

        // If status is provided, filter by it
        if (status) {
            queueQuery = queueQuery.where("status", "==", status);
        }

        // Order by position (ascending) for consistent pagination
        queueQuery = queueQuery.orderBy("position", "asc").limit(limit);

        // If cursor is provided, start after that document
        if (cursorString) {
            const lastDoc = await firestoreDb
                .collection("queue")
                .doc(cursorString)
                .get();
            if (lastDoc.exists) {
                queueQuery = queueQuery.startAfter(lastDoc);
            }
        }

        const queueSnapshot = await queueQuery.get();

        // Map queue documents to Queue type
        const queues: Queue[] = queueSnapshot.docs.map((doc) => {
            const queueData = doc.data();
            return {
                id: doc.id,
                stationId: queueData.stationId,
                counterId: queueData.counterId,
                queueNumber: queueData.queueNumber,
                purpose: queueData.purpose,
                customerEmail: queueData.customerEmail,
                status: queueData.status,
                position: queueData.position,
                estimatedWaitTime: queueData.estimatedWaitTime,
                qrId: queueData.qrId,
                createdAt: queueData.createdAt,
                servedAt: queueData.servedAt,
                servedBy: queueData.servedBy,
                completedAt: queueData.completedAt,
                cancelledAt: queueData.cancelledAt,
                cancelledBy: queueData.cancelledBy,
            };
        });

        const nextCursor =
            queueSnapshot.docs.length > 0 ?
                queueSnapshot.docs[queueSnapshot.docs.length - 1].id :
                null;

        res.status(200).json({
            queues,
            nextCursor,
        });
        return;
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
        return;
    }
};

export const getQueuesByCounter = async (req: Request, res: Response) => {
    try {
        const { counterId } = req.params;
        const { status, limit: limitParam, cursor } = req.query;

        if (!counterId) {
            res.status(400).json({ message: "counterId is required" });
            return;
        }

        const limit = Number(limitParam) || 10;
        const cursorString = cursor as string;

        // Verify counter exists
        const counterDoc = await firestoreDb
            .collection("counters")
            .doc(counterId)
            .get();

        if (!counterDoc.exists) {
            res.status(404).json({ message: "Counter not found" });
            return;
        }

        // Build query for queues for the counter
        let queueQuery = firestoreDb
            .collection("queue")
            .where("counterId", "==", counterId);

        // If status is provided, filter by it
        if (status) {
            queueQuery = queueQuery.where("status", "==", status);
        }

        // Order by position (ascending) for consistent pagination
        queueQuery = queueQuery.orderBy("position", "asc").limit(limit);

        // If cursor is provided, start after that document
        if (cursorString) {
            const lastDoc = await firestoreDb
                .collection("queue")
                .doc(cursorString)
                .get();
            if (lastDoc.exists) {
                queueQuery = queueQuery.startAfter(lastDoc);
            }
        }

        const queueSnapshot = await queueQuery.get();

        // Map queue documents to Queue type
        const queues: Queue[] = queueSnapshot.docs.map((doc) => {
            const queueData = doc.data();
            return {
                id: doc.id,
                stationId: queueData.stationId,
                counterId: queueData.counterId,
                queueNumber: queueData.queueNumber,
                purpose: queueData.purpose,
                customerEmail: queueData.customerEmail,
                status: queueData.status,
                position: queueData.position,
                estimatedWaitTime: queueData.estimatedWaitTime,
                qrId: queueData.qrId,
                createdAt: queueData.createdAt,
                servedAt: queueData.servedAt,
                servedBy: queueData.servedBy,
                completedAt: queueData.completedAt,
                cancelledAt: queueData.cancelledAt,
                cancelledBy: queueData.cancelledBy,
            };
        });

        const nextCursor =
            queueSnapshot.docs.length > 0 ?
                queueSnapshot.docs[queueSnapshot.docs.length - 1].id :
                null;

        res.status(200).json({
            queues,
            nextCursor,
        });
        return;
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
        return;
    }
};

export const startService = async (req: Request, res: Response) => {
    try {
        const { queueId } = req.params;
        const { counterId } = startServiceSchema.parse(req.body);

        if (!queueId) {
            res.status(400).json({ message: "queueId is required" });
            return;
        }

        // Verify queue exists
        const queueRef = firestoreDb.collection("queue").doc(queueId);
        const queueDoc = await queueRef.get();

        if (!queueDoc.exists) {
            res.status(404).json({ message: "Queue not found" });
            return;
        }

        const queueData = queueDoc.data();

        // Validate queue status - should be "waiting" to start service
        if (queueData?.status !== "waiting") {
            res.status(400).json({
                message: `Cannot start service. Queue status is "${queueData?.status}"`,
            });
            return;
        }

        // Verify counter exists
        const counterDoc = await firestoreDb
            .collection("counters")
            .doc(counterId)
            .get();

        if (!counterDoc.exists) {
            res.status(404).json({ message: "Counter not found" });
            return;
        }


        // Update queue to start service
        const servedAt = FieldValue.serverTimestamp() as Timestamp;
        const servedBy = req.user!.uid;
        await queueRef.update({
            status: "serving",
            counterId,
            servedAt,
            servedBy,
        });

        // Get updated queue data
        const updatedQueueDoc = await queueRef.get();
        const updatedQueueData = updatedQueueDoc.data();

        const responseData = {
            queueId: updatedQueueDoc.id,
            queueNumber: updatedQueueData?.queueNumber,
            status: updatedQueueData?.status,
            counterId: updatedQueueData?.counterId,
            servedAt: updatedQueueData?.servedAt,
            servedBy: updatedQueueData?.servedBy,
        };

        res.status(200).json({
            success: true,
            data: responseData,
        });
        return;
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                message: error.errors.map((err) => err.message).join(", "),
            });
            return;
        } else {
            res.status(500).json({ message: (error as Error).message });
            return;
        }
    }
};

export const completeService = async (req: Request, res: Response) => {
    try {
        const { queueId } = req.params;
        completeServiceSchema.parse(req.body);

        if (!queueId) {
            res.status(400).json({ message: "queueId is required" });
            return;
        }

        // Verify queue exists
        const queueRef = firestoreDb.collection("queue").doc(queueId);
        const queueDoc = await queueRef.get();

        if (!queueDoc.exists) {
            res.status(404).json({ message: "Queue not found" });
            return;
        }

        const queueData = queueDoc.data();

        // Validate queue status - should be "serving" to complete service
        if (queueData?.status !== "serving") {
            res.status(400).json({
                message: `Cannot complete service. Queue status is "${queueData?.status}"`,
            });
            return;
        }

        // Update queue to complete service
        const completedAt = FieldValue.serverTimestamp() as Timestamp;
        await queueRef.update({
            status: "completed",
            completedAt,
        });

        // Revoke the corresponding customer-session
        if (queueData?.qrId) {
            const customerSessionRef = firestoreDb
                .collection("customer-sessions")
                .doc(queueData.qrId);
            await customerSessionRef.update({
                used: true,
                status: "completed",
            });
        }

        // Get updated queue data
        const updatedQueueDoc = await queueRef.get();
        const updatedQueueData = updatedQueueDoc.data();

        const responseData = {
            queueId: updatedQueueDoc.id,
            queueNumber: updatedQueueData?.queueNumber,
            status: updatedQueueData?.status,
            completedAt: updatedQueueData?.completedAt,
        };

        res.status(200).json({
            success: true,
            data: responseData,
        });
        return;
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                message: error.errors.map((err) => err.message).join(", "),
            });
            return;
        } else {
            res.status(500).json({ message: (error as Error).message });
            return;
        }
    }
};

export const cancelQueue = async (req: Request, res: Response) => {
    try {
        const { queueId } = req.params;
        cancelQueueSchema.parse(req.body);

        if (!queueId) {
            res.status(400).json({ message: "queueId is required" });
            return;
        }

        // Verify queue exists
        const queueRef = firestoreDb.collection("queue").doc(queueId);
        const queueDoc = await queueRef.get();

        if (!queueDoc.exists) {
            res.status(404).json({ message: "Queue not found" });
            return;
        }

        const queueData = queueDoc.data();

        // Validate queue status - should be "waiting" or "serving" to cancel
        if (queueData?.status !== "waiting" && queueData?.status !== "serving") {
            res.status(400).json({
                message: `Cannot cancel queue. Queue status is "${queueData?.status}"`,
            });
            return;
        }

        // Update queue to cancelled
        const cancelledAt = FieldValue.serverTimestamp() as Timestamp;
        const cancelledBy = req.user?.uid;
        await queueRef.update({
            status: "cancelled",
            cancelledAt,
            cancelledBy,
        });

        // Revoke the corresponding customer-session
        if (queueData?.qrId) {
            const customerSessionRef = firestoreDb
                .collection("customer-sessions")
                .doc(queueData.qrId);
            await customerSessionRef.update({
                used: true,
                status: "completed",
            });
        }

        // Get updated queue data
        const updatedQueueDoc = await queueRef.get();
        const updatedQueueData = updatedQueueDoc.data();

        const responseData = {
            queueId: updatedQueueDoc.id,
            queueNumber: updatedQueueData?.queueNumber,
            status: updatedQueueData?.status,
            cancelledAt: updatedQueueData?.cancelledAt,
        };

        res.status(200).json({
            success: true,
            data: responseData,
        });
        return;
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                message: error.errors.map((err) => err.message).join(", "),
            });
            return;
        } else {
            res.status(500).json({ message: (error as Error).message });
            return;
        }
    }
};

export const markNoShow = async (req: Request, res: Response) => {
    try {
        const { queueId } = req.params;

        if (!queueId) {
            res.status(400).json({ message: "queueId is required" });
            return;
        }

        // Verify queue exists
        const queueRef = firestoreDb.collection("queue").doc(queueId);
        const queueDoc = await queueRef.get();

        if (!queueDoc.exists) {
            res.status(404).json({ message: "Queue not found" });
            return;
        }

        const queueData = queueDoc.data();

        // Validate queue status - should be "waiting" or "serving" to mark as no-show
        if (queueData?.status !== "waiting" && queueData?.status !== "serving") {
            res.status(400).json({
                message: `Cannot mark as no-show. Queue status is "${queueData?.status}"`,
            });
            return;
        }

        const stationId = queueData?.stationId;
        const currentPosition = queueData?.position;

        // Get all remaining queues in the same station before updating
        // This allows us to recalculate positions correctly
        const remainingQueuesRef = firestoreDb
            .collection("queue")
            .where("stationId", "==", stationId)
            .where("status", "in", ["waiting", "serving"])
            .orderBy("position", "asc");

        const remainingQueuesSnapshot = await remainingQueuesRef.get();

        // Update queue to no-show
        const cancelledAt = FieldValue.serverTimestamp() as Timestamp;
        const cancelledBy = req.user!.uid;
        await queueRef.update({
            status: "no_show",
            cancelledAt,
            cancelledBy,
        });

        // Recalculate positions for remaining queues in the same station
        if (stationId && currentPosition && remainingQueuesSnapshot.docs.length > 0) {
            const batch = firestoreDb.batch();
            let newPosition = 1;

            remainingQueuesSnapshot.docs.forEach((doc) => {
                // Skip the queue that was just marked as no-show
                if (doc.id !== queueId) {
                    const docData = doc.data();
                    const oldPosition = docData.position;

                    // Reassign positions sequentially
                    // Queues before no-show keep their position (no update needed)
                    // Queues after no-show get decremented by 1
                    if (oldPosition < currentPosition) {
                        // Position stays the same, just track for next position
                        newPosition = oldPosition + 1;
                    } else if (oldPosition > currentPosition) {
                        // Update queue position to newPosition (which is one less than oldPosition)
                        // Then increment newPosition for the next queue in sequence
                        batch.update(doc.ref, { position: newPosition });
                        newPosition++;
                    }
                }
            });

            // Execute batch update if there are any updates to make
            const hasUpdates = remainingQueuesSnapshot.docs.some(
                (doc) => doc.id !== queueId && doc.data().position > currentPosition
            );
            if (hasUpdates) {
                await batch.commit();
            }
        }

        // Revoke the corresponding customer-session
        if (queueData?.qrId) {
            const customerSessionRef = firestoreDb
                .collection("customer-sessions")
                .doc(queueData.qrId);
            await customerSessionRef.update({
                used: true,
                status: "completed",
            });
        }

        // Get updated queue data
        const updatedQueueDoc = await queueRef.get();
        const updatedQueueData = updatedQueueDoc.data();

        const responseData = {
            queueId: updatedQueueDoc.id,
            queueNumber: updatedQueueData?.queueNumber,
            status: updatedQueueData?.status,
            cancelledAt: updatedQueueData?.cancelledAt,
        };

        res.status(200).json({
            success: true,
            data: responseData,
        });
        return;
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
        return;
    }
};
