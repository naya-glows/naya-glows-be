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
