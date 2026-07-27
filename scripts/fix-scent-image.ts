import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import path from "path";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// upload-recent-images.ts originally mis-identified IMG_5207 as
// "radiance-balance-toner-boxed" — it's actually the Naya Luxe perfume
// bottle (confirmed by reading the label), and the user has since renamed
// the local file to naya-evocative-scent.png. That old Cloudinary asset was
// never referenced anywhere in the app, so this just re-uploads under the
// correct public_id rather than leaving a mislabeled asset around.
async function main() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("CLOUDINARY_CLOUD_NAME is not set — check backend/.env");
  }

  const filePath = path.join(__dirname, "../../public/images/recent/naya-evocative-scent.png");
  const result = await cloudinary.uploader.upload(filePath, {
    folder: "naya-glows/recent",
    public_id: "naya-evocative-scent",
    resource_type: "image",
    overwrite: true,
  });

  console.log(`naya-evocative-scent.png -> ${result.secure_url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
