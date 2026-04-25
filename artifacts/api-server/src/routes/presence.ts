import { Router, type IRouter } from "express";
import { GetPresenceResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { snapshot } from "../lib/presence";

const router: IRouter = Router();

router.get("/presence", requireAuth, (_req, res): void => {
  const data = GetPresenceResponse.parse(snapshot());
  res.json(data);
});

export default router;
