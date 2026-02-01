import { Router } from "express";
import {
    cancelQueue,
    completeService,
    generateQrCode,
    getAvailableStations,
    getCounter,
    getCurrentServing,
    getQueue,
    getQueueAccess,
    getQueuesByCounter,
    getQueuesByStation,
    joinQueue,
    markNoShow,
    startService,
} from "../controllers/queueControllers";
import { verifyAuthTokenAndDomain } from "../middlewares/verifyAuthTokenAndDomain";
import { verifyRole } from "../middlewares/verifyRole";
import { verifyCustomerSession } from "../middlewares/verifyCustomerSession";

// eslint-disable-next-line new-cap
const router: Router = Router();

// Public routes
router.get("/queue-access", getQueueAccess);

// Customer routes - use verifyCustomerSession
router.post("/join", verifyCustomerSession("form"), joinQueue);
router.get("/queue", verifyCustomerSession("queue"), getQueue);
router.get("/counters/:counterId", verifyCustomerSession("queue"), getCounter);

// Cashier/Admin routes - use verifyAuthTokenAndDomain and verifyRole
router.get(
    "/qrcode",
    verifyAuthTokenAndDomain,
    verifyRole(["cashier", "admin", "superAdmin", "information"]),
    generateQrCode
);
router.get(
    "/available-stations",
    verifyCustomerSession("form"),
    getAvailableStations
);
router.get(
    "/station/:stationId",
    verifyAuthTokenAndDomain,
    verifyRole(["cashier", "admin", "superAdmin"]),
    getQueuesByStation
);
router.get(
    "/counter/:counterId",
    verifyAuthTokenAndDomain,
    verifyRole(["cashier", "admin", "superAdmin"]),
    getQueuesByCounter
);
router.get(
    "/counter/:counterId/current-serving",
    verifyAuthTokenAndDomain,
    verifyRole(["cashier", "admin", "superAdmin"]),
    getCurrentServing
);
router.post(
    "/:queueId/start-service",
    verifyAuthTokenAndDomain,
    verifyRole(["cashier", "admin", "superAdmin"]),
    startService
);
router.post(
    "/:queueId/complete",
    verifyAuthTokenAndDomain,
    verifyRole(["cashier", "admin", "superAdmin"]),
    completeService
);
router.post(
    "/:queueId/cancel",
    verifyCustomerSession("queue"),
    cancelQueue
);
router.post(
    "/:queueId/mark-no-show",
    verifyAuthTokenAndDomain,
    verifyRole(["cashier", "admin", "superAdmin"]),
    markNoShow
);

export default router;
