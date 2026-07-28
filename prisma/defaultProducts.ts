// Re-exports the real data from src/data/defaultProducts.ts, which is
// where it needs to live so src/lib/runSeed.ts (compiled and run on every
// server boot) can import it within tsconfig's rootDir. This file only
// exists so the one-off migration scripts under backend/scripts/*.ts (run
// via `npx tsx scripts/whatever.ts`, never compiled) don't need their
// import paths changed.
export { defaultProducts } from "../src/data/defaultProducts";
