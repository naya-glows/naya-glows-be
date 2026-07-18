import { prisma } from "../../lib/prisma";

export function listActiveProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

export function getProductBySlug(slug: string) {
  return prisma.product.findUnique({ where: { slug } });
}

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
  isActive?: boolean;
};

export function createProduct(input: ProductInput) {
  return prisma.product.create({ data: input });
}

export function updateProduct(slug: string, input: Partial<ProductInput>) {
  return prisma.product.update({ where: { slug }, data: input });
}

export function deleteProduct(slug: string) {
  return prisma.product.delete({ where: { slug } });
}
