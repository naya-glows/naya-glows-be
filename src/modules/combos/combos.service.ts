import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/appError";
import { toSetchProduct, pushProductsToSetch, deleteProductFromSetch } from "../../lib/setch";

export type ComboInput = {
  slug: string;
  name: string;
  description: string;
  coverImage?: string | null;
  price: number;
  productSlugs: string[];
  isActive?: boolean;
};

export function listCombos() {
  return prisma.combo.findMany({ orderBy: { createdAt: "desc" } });
}

export function listActiveCombos() {
  return prisma.combo.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } });
}

export function getComboBySlug(slug: string) {
  return prisma.combo.findUnique({ where: { slug } });
}

// Every combo also upserts a matching Product row — isCombo: true, same
// slug — so it flows through cart/checkout/tracking/admin-orders completely
// unmodified (see schema.prisma's comment on Product.isCombo for why this
// was chosen over a parallel OrderItem.comboId). originalPrice is set to
// the sum of the bundled products' own prices, so the existing storefront
// strikethrough-discount display (originalPrice > price) shows the savings
// automatically with no new UI logic.
async function syncComboProduct(combo: {
  slug: string;
  name: string;
  description: string;
  coverImage: string | null;
  price: number;
  productSlugs: string[];
  isActive: boolean;
}) {
  const bundled = await prisma.product.findMany({ where: { slug: { in: combo.productSlugs } } });
  const originalPrice = bundled.reduce((sum, p) => sum + p.price, 0) || combo.price;
  const image = combo.coverImage || bundled[0]?.image || "/images/product-placeholder.svg";
  const benefits = bundled.map((p) => `Includes ${p.name}`);

  const synced = await prisma.product.upsert({
    where: { slug: combo.slug },
    create: {
      slug: combo.slug,
      name: combo.name,
      category: "Combo",
      price: combo.price,
      originalPrice,
      image,
      tagline: "Bundle deal",
      description: combo.description,
      benefits,
      isActive: combo.isActive,
      inStock: true,
      isCombo: true,
      comboProductSlugs: combo.productSlugs,
    },
    update: {
      name: combo.name,
      price: combo.price,
      originalPrice,
      image,
      description: combo.description,
      benefits,
      isActive: combo.isActive,
      comboProductSlugs: combo.productSlugs,
    },
  });

  // Same Setch catalog sync every other product create/update gets (see
  // products.routes.ts) — combos go through this upsert instead of
  // createProduct/updateProduct, so it isn't automatic.
  if (synced.isActive) {
    await pushProductsToSetch([toSetchProduct(synced)]).catch((err) =>
      console.error("[setch] Failed to push combo product:", err),
    );
  } else {
    await deleteProductFromSetch(synced.slug).catch((err) =>
      console.error("[setch] Failed to remove deactivated combo product:", err),
    );
  }
}

export async function createCombo(input: ComboInput) {
  if (input.productSlugs.length < 2) {
    throw new AppError("A combo needs at least 2 products");
  }
  const combo = await prisma.combo.create({
    data: {
      slug: input.slug,
      name: input.name,
      description: input.description,
      coverImage: input.coverImage ?? null,
      price: input.price,
      productSlugs: input.productSlugs,
      isActive: input.isActive ?? true,
    },
  });
  await syncComboProduct({ ...combo });
  return combo;
}

export async function updateCombo(slug: string, input: Partial<ComboInput>) {
  if (input.productSlugs && input.productSlugs.length < 2) {
    throw new AppError("A combo needs at least 2 products");
  }
  const combo = await prisma.combo.update({
    where: { slug },
    data: {
      name: input.name,
      description: input.description,
      coverImage: input.coverImage,
      price: input.price,
      productSlugs: input.productSlugs,
      isActive: input.isActive,
    },
  });
  await syncComboProduct({ ...combo });
  return combo;
}

export async function deleteCombo(slug: string) {
  await prisma.combo.delete({ where: { slug } });
  // The synthetic Product row is removed too — a deleted combo shouldn't
  // remain purchasable via a stale direct product link.
  await prisma.product.deleteMany({ where: { slug, isCombo: true } });
  await deleteProductFromSetch(slug).catch((err) =>
    console.error("[setch] Failed to remove deleted combo product:", err),
  );
}
