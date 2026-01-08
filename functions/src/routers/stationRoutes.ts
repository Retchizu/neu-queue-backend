import { Router } from "express";
import { verifyRole } from "../middlewares/verifyRole";
import {
  addStation,
  deleteStation,
  getStation,
  getStations,
  updateStation,
} from "@/controllers/stationControllers";
import { checkStationActivation } from "../middlewares/checkStationActivation";
import { verifyAuthTokenAndDomain } from "@/middlewares/verifyAuthTokenAndDomain";

// eslint-disable-next-line new-cap
const router: Router = Router();

router.use(verifyAuthTokenAndDomain, verifyRole(["admin", "superAdmin"]));

router.post("/stations", addStation);
router.get("/stations", getStations);
router.get("/stations/:stationId", getStation);
router.delete("/delete/:stationId", checkStationActivation, deleteStation);
router.put("/stations/:stationId", updateStation);

export default router;
