import { Router } from "express";
import { verifyAuthTokenAndDomain } from "../middlewares/verifyAuthTokenAndDomain";
import { verifyRole } from "../middlewares/verifyRole";
import {
    addCounter,
    deleteCounter,
    enterCounter,
    getCounters,
    getCountersByStation,
    updateCounter,
    exitCounter,
} from "../controllers/counterControllers";

// eslint-disable-next-line new-cap
const router: Router = Router();

router.use(verifyAuthTokenAndDomain);

router.post("/", verifyRole(["admin", "superAdmin"]), addCounter);
router.get("/", verifyRole(["admin", "superAdmin"]), getCounters);
router.get("/:stationId", verifyRole(["admin", "superAdmin"]), getCountersByStation);
router.delete("/:counterId", verifyRole(["admin", "superAdmin"]), deleteCounter);
router.put("/:counterId", verifyRole(["admin", "superAdmin"]), updateCounter);
router.post("/:counterId/enter", verifyRole(["cashier"]), enterCounter);
router.post("/:counterId/exit", verifyRole(["cashier"]), exitCounter);


export default router;
