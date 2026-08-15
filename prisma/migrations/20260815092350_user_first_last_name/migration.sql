-- Splits User.name into firstName/lastName. Safe for existing rows:
-- add nullable, backfill by splitting the old value on the first space,
-- THEN constrain — avoids the interactive data-loss prompt `prisma migrate
-- dev` would otherwise show for a new required column on a non-empty table.

ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- "Jane Doe" -> firstName "Jane", lastName "Doe".
-- "Cher" (no space) -> firstName "Cher", lastName "" (nothing to split).
UPDATE "User"
SET
  "firstName" = CASE
    WHEN POSITION(' ' IN "name") > 0 THEN SUBSTRING("name" FROM 1 FOR POSITION(' ' IN "name") - 1)
    ELSE "name"
  END,
  "lastName" = CASE
    WHEN POSITION(' ' IN "name") > 0 THEN TRIM(SUBSTRING("name" FROM POSITION(' ' IN "name") + 1))
    ELSE ''
  END;

ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" SET NOT NULL;
ALTER TABLE "User" DROP COLUMN "name";
