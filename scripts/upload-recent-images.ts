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

// One-time upload of the new "recent" photoshoot batch (public/images/recent/)
// to Cloudinary, under descriptive public_ids identified by reading each
// product's actual printed label — the original filenames (IMG_5183.png
// etc.) carry no product information at all.
const RECENT_DIR = path.join(__dirname, "../../public/images/recent");
const OUTPUT_MAP_PATH = path.join(__dirname, "recent-images-map.json");

// filename -> descriptive public_id (without extension)
const NAME_MAP: Record<string, string> = {
  "IMG_5183.png": "naya-full-lineup-group-1",
  "IMG_5184.png": "clarifying-foaming-cleanser",
  "IMG_5185.png": "radiance-boost-serum",
  "IMG_5186.png": "radiance-nourishing-body-butter",
  "IMG_5187.png": "radiance-purifying-body-wash",
  "IMG_5188.png": "radiance-exfoliating-body-scrub",
  "IMG_5189.png": "luminous-glow-body-oil",
  "IMG_5190.png": "radiance-repair-body-lotion",
  "IMG_5191.png": "naya-barrier-face-oil",
  "IMG_5192.png": "radiance-clarifying-black-soap",
  "IMG_5193.png": "glow-renewal-serum-acne-treatment",
  "IMG_5194.png": "pigment-corrector-face-cream",
  "IMG_5195.png": "radiant-renewal-face-cream",
  "IMG_5196.png": "radiance-correcting-serum-spot-remover",
  "IMG_5197.png": "radiance-balance-toner-alt1",
  "IMG_5207.png": "radiance-balance-toner-boxed",
  "IMG_5208.png": "naya-luxe-scent",
  "IMG_7860.PNG": "radiance-clarifying-black-soap-alt2",
  "IMG_7861.PNG": "radiance-balance-toner-alt2",
  "IMG_7862.PNG": "radiance-correcting-serum-alt2",
  "IMG_7863.PNG": "pigment-corrector-face-cream-alt2",
  "IMG_7864.PNG": "glow-renewal-serum-alt2",
  "IMG_7865.PNG": "radiance-repair-body-lotion-alt2",
  "IMG_7866.PNG": "radiance-purifying-body-wash-alt2",
  "IMG_7867.PNG": "radiance-exfoliating-body-scrub-alt2",
  "IMG_7868.PNG": "radiance-nourishing-body-butter-alt2",
  "IMG_7869.PNG": "naya-full-lineup-group-2",
  "IMG_7870.PNG": "clarifying-foaming-cleanser-alt2",
  "IMG_7871.PNG": "radiance-boost-serum-styled",
  "IMG_7872.PNG": "radiance-correcting-serum-styled",
  "IMG_8237.JPG": "customer-ugc-testimonial-scrub",
  "copy_2842D01C-E6D7-4408-8530-07345975678B.MOV": "customer-testimonial-video",
};

async function main() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("CLOUDINARY_CLOUD_NAME is not set — check backend/.env");
  }

  const files = fs.readdirSync(RECENT_DIR).sort();
  const map: Record<string, string> = {};

  console.log(`Found ${files.length} file(s) in public/images/recent. Uploading...\n`);

  for (const filename of files) {
    const publicId = NAME_MAP[filename];
    if (!publicId) {
      console.warn(`  ! No name mapping for "${filename}" — skipping`);
      continue;
    }

    const filePath = path.join(RECENT_DIR, filename);
    const isVideo = path.extname(filename).toLowerCase() === ".mov";

    const result = await cloudinary.uploader.upload(filePath, {
      folder: "naya-glows/recent",
      public_id: publicId,
      resource_type: isVideo ? "video" : "image",
      overwrite: true,
    });

    map[filename] = result.secure_url;
    map[publicId] = result.secure_url;
    console.log(`  ${filename} (${publicId}) -> ${result.secure_url}`);
  }

  fs.writeFileSync(OUTPUT_MAP_PATH, JSON.stringify(map, null, 2));
  console.log(`\nDone. Wrote ${Object.keys(map).length} mapping(s) to ${OUTPUT_MAP_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
