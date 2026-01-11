import { Router } from "express";
import { verifyRole } from "../middlewares/verifyRole";
import {
    addStation,
    deleteStation,
    getStation,
    getStations,
    updateStation,
} from "@/controllers/stationControllers";
import { verifyAuthTokenAndDomain } from "@/middlewares/verifyAuthTokenAndDomain";

// eslint-disable-next-line new-cap
const router: Router = Router();

router.use(verifyAuthTokenAndDomain, verifyRole(["admin", "superAdmin"]));

router.post("/", addStation);
router.get("/", getStations);
router.get("/:stationId", getStation);
router.delete("/:stationId", deleteStation);
router.put("/:stationId", updateStation);

export default router;
