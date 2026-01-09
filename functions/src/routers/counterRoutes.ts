import { Router } from "express";
import { verifyAuthTokenAndDomain } from "../middlewares/verifyAuthTokenAndDomain";
import { verifyRole } from "../middlewares/verifyRole";
import {
    addCounter,
    deleteCounter,
    enterCounter,
    getCounters,
    updateCounter,
} from "../controllers/counterControllers";

// eslint-disable-next-line new-cap
const router: Router = Router();

router.use(verifyAuthTokenAndDomain, verifyRole(["admin", "superAdmin"]));

router.post("/counters", addCounter);
router.get("/counters", getCounters);
router.delete("/counters/:counterId", deleteCounter);
router.put("/counters/:counterId", updateCounter);
router.post("/counters/:counterId/enter", enterCounter);

export default router;
