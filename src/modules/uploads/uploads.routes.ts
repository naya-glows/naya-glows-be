import { Router } from "express";
import multer from "multer";
import { requireAdmin, type AuthedRequest } from "../../middleware/auth";
import { uploadToCloudinary } from "../../lib/cloudinary";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const router = Router();

router.post("/", requireAdmin, upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const url = await uploadToCloudinary(req.file.buffer);
    res.status(201).json({ url });
  } catch (err) {
    console.error(
      `[error] POST /uploads — user=${req.auth?.userId ?? "anonymous"} role=${req.auth?.role ?? "none"}`,
      err,
    );
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

export default router;
