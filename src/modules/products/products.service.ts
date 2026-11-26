import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

// Prisma's Json columns need the sentinel Prisma.JsonNull for an explicit
// SQL null, not the JS value `null` (which instead means "no reference to
// this field" in Prisma's typings) — this converts between the two.
function toJsonInput(variants: ProductVariant[] | null | undefined) {
  if (variants === null) return Prisma.JsonNull;
  return variants;
}

export function listActiveProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

export function getProductBySlug(slug: string) {
  return prisma.product.findUnique({ where: { slug } });
}

export type ProductSearchFilters = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
};

// Backs Setch's "Connect your product search" live search (see
// products.routes.ts's GET /search) — called directly by Setch at
// question time rather than from its own periodically-synced copy (see
// lib/setch.ts's syncAllProductsToSetch), so results always reflect
// whatever's true in the database right now.
export function searchActiveProducts(filters: ProductSearchFilters) {
  const q = filters.q?.trim();
  // minPrice/maxPrice both constrain the same `price` column, so they have
  // to merge into one Prisma filter object — two separate spreads here
  // would make whichever applies second silently overwrite the first.
  const priceFilter: Prisma.FloatFilter = {};
  if (filters.minPrice !== undefined) priceFilter.gte = filters.minPrice;
  if (filters.maxPrice !== undefined) priceFilter.lte = filters.maxPrice;

  return prisma.product.findMany({
    where: {
      isActive: true,
      ...(filters.category ? { category: { equals: filters.category, mode: "insensitive" } } : {}),
      ...(Object.keys(priceFilter).length > 0 ? { price: priceFilter } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { tagline: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
}

export type ProductVariant = { name: string; price: number };

export type ProductInput = {
  slug: string;
  name: string;
  category: string;
  categoryAccent?: string;
  price: number;
  originalPrice: number;
  image: string;
  tagline: string;
  description: string;
  benefits: string[];
  variants?: ProductVariant[] | null;
  isActive?: boolean;
  inStock?: boolean;
};

export function createProduct(input: ProductInput) {
  return prisma.product.create({
    data: { ...input, variants: toJsonInput(input.variants) },
  });
}

export function updateProduct(slug: string, input: Partial<ProductInput>) {
  return prisma.product.update({
    where: { slug },
    data: { ...input, variants: "variants" in input ? toJsonInput(input.variants) : undefined },
  });
}

export function deleteProduct(slug: string) {
  return prisma.product.delete({ where: { slug } });
}
