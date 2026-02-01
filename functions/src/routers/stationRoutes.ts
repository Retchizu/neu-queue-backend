import { Router } from "express";
import { verifyRole } from "../middlewares/verifyRole";
import {
    addStation,
    deleteStation,
    getAssignedStation,
    getStation,
    getStations,
    updateStation,
} from "@/controllers/stationControllers";
import { verifyAuthTokenAndDomain } from "@/middlewares/verifyAuthTokenAndDomain";

// eslint-disable-next-line new-cap
const router: Router = Router();

router.use(verifyAuthTokenAndDomain);

// Cashier route - must be before the admin routes to avoid conflicts
router.get("/assigned", verifyRole(["cashier"]), getAssignedStation);

// Admin routes
router.post("/", verifyRole(["admin", "superAdmin"]), addStation);
router.get("/", verifyRole(["admin", "superAdmin"]), getStations);
router.get("/:stationId", verifyRole(["admin", "superAdmin", "cashier"]), getStation);
router.delete("/:stationId", verifyRole(["admin", "superAdmin"]), deleteStation);
router.put("/:stationId", verifyRole(["admin", "superAdmin"]), updateStation);

export default router;
