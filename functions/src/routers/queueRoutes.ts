import { Router } from "express";
import {
    cancelQueue,
    completeService,
    generateQrCode,
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

// Cashier/Admin routes - use verifyAuthTokenAndDomain and verifyRole
router.get(
    "/qrcode",
    verifyAuthTokenAndDomain,
    verifyRole(["cashier", "admin", "superAdmin"]),
    generateQrCode
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
    verifyAuthTokenAndDomain,
    verifyRole(["cashier", "admin", "superAdmin"]),
    cancelQueue
);
router.post(
    "/:queueId/mark-no-show",
    verifyAuthTokenAndDomain,
    verifyRole(["cashier", "admin", "superAdmin"]),
    markNoShow
);

export default router;
