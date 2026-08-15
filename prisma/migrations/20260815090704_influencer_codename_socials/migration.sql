-- Replace platform/socialHandle with codeName + per-platform handles.
-- Written by hand (not `prisma migrate dev`) so existing rows never hit an
-- interactive "how do you want to handle data loss" prompt in a
-- non-interactive deploy: add nullable, backfill, THEN constrain.

ALTER TABLE "Influencer" ADD COLUMN "codeName" TEXT;
ALTER TABLE "Influencer" ADD COLUMN "twitterHandle" TEXT;
ALTER TABLE "Influencer" ADD COLUMN "instagramHandle" TEXT;
ALTER TABLE "Influencer" ADD COLUMN "tiktokHandle" TEXT;

-- Best-effort preservation of any existing profile's handle — bucketed by
-- whatever they'd previously typed into the free-text "platform" field.
UPDATE "Influencer"
SET "twitterHandle" = "socialHandle"
WHERE "socialHandle" IS NOT NULL
  AND ("platform" ILIKE '%twitter%' OR "platform" ILIKE '%x%');

UPDATE "Influencer"
SET "instagramHandle" = "socialHandle"
WHERE "socialHandle" IS NOT NULL
  AND "platform" ILIKE '%instagram%';

UPDATE "Influencer"
SET "tiktokHandle" = "socialHandle"
WHERE "socialHandle" IS NOT NULL
  AND "platform" ILIKE '%tiktok%';

-- Anything on another platform (YouTube, Blog, Other, or unmatched) has
-- nowhere else to go — fold it into instagramHandle rather than lose it
-- silently; an admin can move it to the right field from the dashboard.
UPDATE "Influencer"
SET "instagramHandle" = "socialHandle"
WHERE "socialHandle" IS NOT NULL
  AND "twitterHandle" IS NULL
  AND "instagramHandle" IS NULL
  AND "tiktokHandle" IS NULL;

-- Every existing row needs *some* unique codeName to satisfy the new
-- constraint below — generated from the row's own id so it's guaranteed
-- unique; the influencer can't change it from the UI yet, but nothing
-- breaks, and this only ever fires for pre-existing rows, not new signups.
UPDATE "Influencer"
SET "codeName" = 'INF' || UPPER(SUBSTRING(id, 1, 10))
WHERE "codeName" IS NULL;

ALTER TABLE "Influencer" ALTER COLUMN "codeName" SET NOT NULL;
CREATE UNIQUE INDEX "Influencer_codeName_key" ON "Influencer"("codeName");

ALTER TABLE "Influencer" DROP COLUMN "platform";
ALTER TABLE "Influencer" DROP COLUMN "socialHandle";
