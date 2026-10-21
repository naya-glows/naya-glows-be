import { Router } from "express";
import multer from "multer";
import { requireAdmin, type AuthedRequest } from "../../middleware/auth";
import { uploadToCloudinary } from "../../lib/cloudinary";

// Every call site today is uploading a photo (product, content, category
// images) — nothing in the app has a reason to upload any other file type,
// so there's no legitimate case this narrows out. Deliberately excludes
// SVG even though it's an image format: an SVG can embed <script>, which
// Cloudinary doesn't strip, making unrestricted SVG upload a stored-XSS
// vector the moment that URL is ever opened directly rather than rendered
// through next/image.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WEBP, or GIF images are allowed"));
    }
    cb(null, true);
  },
});

const router = Router();

router.post(
  "/",
  requireAdmin,
  // multer's own middleware form (upload.single(...) passed directly to the
  // router) hands a fileFilter/file-size-limit rejection to Express's error
  // pipeline, which falls through to app.ts's catch-all and comes back as a
  // generic 500 — wrapping it here turns that into the real 400 + reason.
  (req: AuthedRequest, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
      }
      next();
    });
  },
  async (req: AuthedRequest, res) => {
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
  },
);

export default router;
