import { Router, Request, Response } from "express";
import prisma from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/stats/all", requireAuth, async (req: Request, res: Response) => {
  const expenses = await prisma.expense.findMany({ where: { userId: req.userId } });
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory: Record<string, number> = {};
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  res.json({ totalExpenses, byCategory });
});

router.get("/monthly/all", requireAuth, async (req: Request, res: Response) => {
  const expenses = await prisma.expense.findMany({ where: { userId: req.userId } });
  const byMonth: Record<string, number> = {};
  for (const e of expenses) {
    const month = e.date.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + e.amount;
  }
  res.json(Object.entries(byMonth).map(([month, total]) => ({ month, total })).sort((a, b) => a.month.localeCompare(b.month)));
});

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const expenses = await prisma.expense.findMany({
    where: { userId: req.userId },
    orderBy: { date: "desc" },
  });
  res.json(expenses);
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { description, amount, category, date, note } = req.body;
  const expense = await prisma.expense.create({
    data: { userId: req.userId!, description, amount, category, date, note },
  });
  res.json(expense);
});

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const { description, amount, category, date, note } = req.body;
  const expense = await prisma.expense.update({
    where: { id: req.params.id },
    data: { description, amount, category, date, note },
  });
  res.json(expense);
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  await prisma.expense.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
