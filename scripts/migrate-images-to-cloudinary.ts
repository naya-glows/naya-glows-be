import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// One-time migration: every file that currently lives in the frontend's
// public/images/ (referenced in code as "/images/...") gets uploaded to
// Cloudinary, and this writes out a { "/images/...": "https://res.cloudinary.com/..." }
// map that later scripts/edits use to rewrite every reference in the codebase.
const IMAGES_ROOT = path.join(__dirname, "../../public/images");
const OUTPUT_MAP_PATH = path.join(__dirname, "image-migration-map.json");

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function sanitizeSegment(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("CLOUDINARY_CLOUD_NAME is not set — check backend/.env");
  }

  const files = walk(IMAGES_ROOT).sort();
  const map: Record<string, string> = {};

  console.log(`Found ${files.length} file(s) under public/images. Uploading...\n`);

  for (const filePath of files) {
    const relativePath = path.relative(IMAGES_ROOT, filePath).split(path.sep).join("/");
    const ext = path.extname(relativePath);
    const dirName = path.dirname(relativePath);
    const baseName = sanitizeSegment(path.basename(relativePath, ext));
    const folder = dirName === "." ? "naya-glows/legacy" : `naya-glows/legacy/${sanitizeSegment(dirName)}`;
    const isVideo = ext.toLowerCase() === ".mov";

    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      public_id: baseName,
      resource_type: isVideo ? "video" : "image",
      overwrite: true,
    });

    const localKey = `/images/${relativePath}`;
    map[localKey] = result.secure_url;
    // Also map the URL-encoded form (spaces -> %20) since some code
    // references these paths pre-encoded (e.g. "DSC00339%20copy.jpg").
    const encodedKey = `/images/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
    if (encodedKey !== localKey) map[encodedKey] = result.secure_url;

    console.log(`  ${localKey} -> ${result.secure_url}`);
  }

  fs.writeFileSync(OUTPUT_MAP_PATH, JSON.stringify(map, null, 2));
  console.log(`\nDone. Wrote ${Object.keys(map).length} mapping(s) to ${OUTPUT_MAP_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
