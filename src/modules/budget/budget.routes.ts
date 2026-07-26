import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/auth";

export const adminBudgetRouter = Router();

adminBudgetRouter.get(
  "/summary",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [paidOrders, entries] = await Promise.all([
      prisma.order.findMany({
        where: { status: "PAID" },
        select: { total: true, currency: true },
      }),
      prisma.budgetEntry.findMany(),
    ]);

    // Orders are always created in NGN (see orders.service.ts) — summing
    // raw totals here assumes a single currency, same as everywhere else
    // admin-side order totals are aggregated.
    const orderRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const manualIncome = entries
      .filter((e) => e.type === "income")
      .reduce((sum, e) => sum + e.amount, 0);
    const manualExpense = entries
      .filter((e) => e.type === "expense")
      .reduce((sum, e) => sum + e.amount, 0);

    res.json({
      summary: {
        currency: "NGN",
        paidOrderCount: paidOrders.length,
        orderRevenue,
        manualIncome,
        manualExpense,
        net: orderRevenue + manualIncome - manualExpense,
      },
    });
  }),
);

adminBudgetRouter.get(
  "/entries",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const entries = await prisma.budgetEntry.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ entries });
  }),
);

const createEntrySchema = z.object({
  label: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["income", "expense"]),
  note: z.string().optional(),
});

adminBudgetRouter.post(
  "/entries",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = createEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const entry = await prisma.budgetEntry.create({ data: parsed.data });
    res.status(201).json({ entry });
  }),
);

adminBudgetRouter.delete(
  "/entries/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    await prisma.budgetEntry.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);
