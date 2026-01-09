import { Router, Request, Response} from "express";
import queueRoutes from "@/routers/queueRoutes";
import stationRoutes from "@/routers/stationRoutes";
import counterRoutes from "@/routers/counterRoutes";
import adminRoutes from "@/routers/adminRoutes";
import userRoutes from "@/routers/userRoutes";

// eslint-disable-next-line new-cap
const router = Router();

router.get("/", (req: Request, res: Response) => {
  res.send("<h1>Welcome to NEUQUEUE</h1>");
});

router.use("/queues", queueRoutes);
router.use("/stations", stationRoutes);
router.use("/counters", counterRoutes);
router.use("/admin", adminRoutes);
router.use("/auth", userRoutes);

export default router;
