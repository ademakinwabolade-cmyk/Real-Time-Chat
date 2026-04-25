import { Router, type IRouter } from "express";
import { db, voiceAudioTable, directMessagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get(
  "/dm-audio/:audioId",
  requireAuth,
  async (req, res): Promise<void> => {
    const me = req.userId!;
    const audioId = Number(req.params["audioId"]);
    if (!Number.isFinite(audioId) || audioId <= 0) {
      res.status(400).json({ error: "Invalid audio id" });
      return;
    }

    const [msg] = await db
      .select({
        senderId: directMessagesTable.senderId,
        recipientId: directMessagesTable.recipientId,
      })
      .from(directMessagesTable)
      .where(eq(directMessagesTable.voiceAudioId, audioId))
      .limit(1);

    if (!msg) {
      res.status(404).json({ error: "Audio not found" });
      return;
    }

    if (msg.senderId !== me && msg.recipientId !== me) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [audio] = await db
      .select()
      .from(voiceAudioTable)
      .where(eq(voiceAudioTable.id, audioId))
      .limit(1);

    if (!audio) {
      res.status(404).json({ error: "Audio not found" });
      return;
    }

    res.setHeader("Content-Type", audio.mimeType);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.setHeader("Content-Length", audio.data.length.toString());
    res.send(audio.data);
  },
);

export default router;
