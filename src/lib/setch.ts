import { prisma } from "./prisma";

const SETCH_API = "https://www.usesetch.xyz";
const SITE_URL = "https://nayaglows.skin";

type ProductForSetch = {
  slug: string;
  name: string;
  category: string;
  categoryAccent: string | null;
  price: number;
  image: string;
  description: string;
  tagline: string;
  variants: unknown;
  inStock: boolean;
};

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function slugifyVariantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Maps this project's own Product shape (see products.service.ts) into
// Setch's catalog format. `slug` doubles as the stable external_id — it's
// already the unique, never-reused identifier this project uses for a
// product (there's no separate SKU field).
export function toSetchProduct(product: ProductForSetch) {
  const availability = product.inStock === false ? "out_of_stock" : "in_stock";
  const variants = (product.variants as { name: string; price: number }[] | null) ?? null;

  return {
    external_id: product.slug,
    title: product.name,
    description: product.description || product.tagline,
    brand: "Naya Glows",
    categories: [product.category, product.categoryAccent].filter((c): c is string => Boolean(c)),
    images: [absoluteUrl(product.image)],
    url: absoluteUrl(`/products/${product.slug}`),
    // Naira prices here are always whole numbers already (see
    // lib/products.ts) — sent as a plain integer, never a float.
    price: { amount: Math.round(product.price), currency: "NGN" },
    availability,
    ...(variants && variants.length > 0
      ? {
          variants: variants.map((v) => ({
            external_id: `${product.slug}-${slugifyVariantName(v.name)}`,
            sku: `${product.slug}-${slugifyVariantName(v.name)}`,
            title: v.name,
            price: { amount: Math.round(v.price), currency: "NGN" },
            availability,
          })),
        }
      : {}),
  };
}

type SetchProduct = ReturnType<typeof toSetchProduct>;

async function setchRequest(path: string, init: RequestInit, attempt = 1): Promise<Response | null> {
  const token = process.env.SETCH_TOKEN;
  if (!token) {
    console.log(`[setch] SETCH_TOKEN not configured — skipped ${init.method ?? "GET"} ${path}`);
    return null;
  }

  let res: Response;
  try {
    res = await fetch(`${SETCH_API}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Token ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      return setchRequest(path, init, attempt + 1);
    }
    throw err;
  }

  // Retry rate-limit/server errors with simple linear backoff — a single
  // transient hiccup on Setch's end shouldn't drop a catalog update.
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    return setchRequest(path, init, attempt + 1);
  }
  return res;
}

// `sourceId` — see scripts/setch-create-source.ts to create one; it's
// created once, not per call.
async function pushProductBatch(sourceId: string, batch: SetchProduct[]) {
  try {
    const res = await setchRequest(`/api/catalog/sources/${sourceId}/products/bulk/`, {
      method: "POST",
      body: JSON.stringify({ products: batch }),
    });
    if (res && !res.ok) {
      console.error(`[setch] Bulk push failed (${res.status}): ${await res.text().catch(() => "")}`);
    }
  } catch (err) {
    console.error("[setch] Bulk push request failed:", err);
  }
}

// Batches of at most 200 per Setch's API limit — in practice this
// project's full catalog fits in one batch, but kept generic.
export async function pushProductsToSetch(products: SetchProduct[]): Promise<void> {
  const sourceId = process.env.SETCH_SOURCE_ID;
  if (!sourceId) {
    console.log("[setch] SETCH_SOURCE_ID not configured — skipping catalog push.");
    return;
  }
  for (let i = 0; i < products.length; i += 200) {
    await pushProductBatch(sourceId, products.slice(i, i + 200));
  }
}

export async function deleteProductFromSetch(externalId: string): Promise<void> {
  const sourceId = process.env.SETCH_SOURCE_ID;
  if (!sourceId) return;
  try {
    const res = await setchRequest(
      `/api/catalog/sources/${sourceId}/products/${encodeURIComponent(externalId)}/`,
      { method: "DELETE" },
    );
    if (res && !res.ok && res.status !== 404) {
      console.error(`[setch] Delete failed (${res.status}) for external_id=${externalId}`);
    }
  } catch (err) {
    console.error(`[setch] Delete request failed for external_id=${externalId}:`, err);
  }
}

// Full-catalog push — used by scripts/setch-full-sync.ts (first import)
// and the nightly cron safety net (see api/cron/daily.ts).
export async function syncAllProductsToSetch(): Promise<{ pushed: number }> {
  const products = await prisma.product.findMany({ where: { isActive: true } });
  const payload = products.map(toSetchProduct);
  await pushProductsToSetch(payload);
  return { pushed: payload.length };
}
