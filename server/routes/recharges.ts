import { Router, Request, Response } from "express";
import prisma from "../db";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../activity";

const router = Router();

// Specific routes must come before /:id
router.get("/stats/all", requireAuth, async (req: Request, res: Response) => {
  const recharges = await prisma.recharge.findMany({ where: { userId: req.userId } });
  const totalBilled = recharges.reduce((s, r) => s + r.amount, 0);
  const totalPaid = recharges.filter((r) => r.paid).reduce((s, r) => s + r.amount, 0);
  res.json({ totalBilled, totalPaid, totalUnpaid: totalBilled - totalPaid, unpaidCount: recharges.filter((r) => !r.paid).length });
});

router.get("/unpaid-totals/all", requireAuth, async (req: Request, res: Response) => {
  const recharges = await prisma.recharge.findMany({ where: { userId: req.userId, paid: false } });
  const totals: Record<string, number> = {};
  for (const r of recharges) totals[r.customerId] = (totals[r.customerId] ?? 0) + r.amount;
  res.json(totals);
});

router.get("/monthly/all", requireAuth, async (req: Request, res: Response) => {
  const recharges = await prisma.recharge.findMany({ where: { userId: req.userId } });
  const byMonth: Record<string, { billed: number; collected: number }> = {};
  for (const r of recharges) {
    const month = r.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { billed: 0, collected: 0 };
    byMonth[month].billed += r.amount;
    if (r.paid) byMonth[month].collected += r.amount;
  }
  res.json(Object.entries(byMonth).map(([month, data]) => ({ month, ...data })).sort((a, b) => a.month.localeCompare(b.month)));
});

router.post("/mark-many-paid", requireAuth, async (req: Request, res: Response) => {
  const { rechargeIds, paymentDate, paymentNote } = req.body;
  let count = 0;
  for (const id of rechargeIds) {
    const recharge = await prisma.recharge.findUnique({ where: { id } });
    if (!recharge || recharge.paid) continue;
    await prisma.recharge.update({ where: { id }, data: { paid: true } });
    await prisma.payment.create({
      data: { userId: req.userId!, customerId: recharge.customerId, rechargeId: id, amount: recharge.amount, date: paymentDate, note: paymentNote },
    });
    count++;
  }
  if (count > 0) {
    await logActivity({ userId: req.userId!, action: "recharge.marked_many_paid", entity: "recharge", detail: `${count} recharge(s) marked paid` });
  }
  res.json({ ok: true });
});

router.get("/customer/:customerId", requireAuth, async (req: Request, res: Response) => {
  const recharges = await prisma.recharge.findMany({
    where: { customerId: req.params.customerId },
    include: { package: true },
    orderBy: { date: "desc" },
  });
  res.json(recharges);
});

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const recharges = await prisma.recharge.findMany({
    where: { userId: req.userId },
    include: { customer: true, package: true },
    orderBy: { date: "desc" },
  });
  res.json(recharges);
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const recharge = await prisma.recharge.findUnique({
    where: { id: req.params.id },
    include: { customer: true, package: true },
  });
  res.json(recharge);
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { customerId, packageId, amount, date, note } = req.body;
  const recharge = await prisma.recharge.create({
    data: { userId: req.userId!, customerId, packageId, amount, date, note, paid: false },
  });
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { username: true } });
  const pkg = await prisma.package.findUnique({ where: { id: packageId }, select: { name: true } });
  await logActivity({ userId: req.userId!, action: "recharge.created", entity: "recharge", entityId: recharge.id, detail: `Recharge of ${amount} for ${customer?.username ?? customerId} (${pkg?.name ?? packageId}) recorded` });
  res.json(recharge);
});

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const { packageId, amount, date, note } = req.body;
  const recharge = await prisma.recharge.update({
    where: { id: req.params.id },
    data: { packageId, amount, date, note },
  });
  await logActivity({ userId: req.userId!, action: "recharge.updated", entity: "recharge", entityId: recharge.id, detail: `Recharge ${recharge.id} updated` });
  res.json(recharge);
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const recharge = await prisma.recharge.findUnique({ where: { id: req.params.id } });
  await prisma.recharge.delete({ where: { id: req.params.id } });
  if (recharge) {
    await logActivity({ userId: req.userId!, action: "recharge.deleted", entity: "recharge", entityId: recharge.id, detail: `Recharge ${recharge.id} deleted` });
  }
  res.json({ ok: true });
});

router.post("/:id/mark-paid", requireAuth, async (req: Request, res: Response) => {
  const { paymentDate, paymentNote } = req.body;
  const recharge = await prisma.recharge.findUnique({ where: { id: req.params.id } });
  if (!recharge) { res.status(404).json({ error: "Not found" }); return; }
  await prisma.recharge.update({ where: { id: req.params.id }, data: { paid: true } });
  await prisma.payment.create({
    data: { userId: req.userId!, customerId: recharge.customerId, rechargeId: recharge.id, amount: recharge.amount, date: paymentDate, note: paymentNote },
  });
  const customer = await prisma.customer.findUnique({ where: { id: recharge.customerId }, select: { username: true } });
  await logActivity({ userId: req.userId!, action: "recharge.marked_paid", entity: "recharge", entityId: recharge.id, detail: `Recharge of ${recharge.amount} for ${customer?.username ?? recharge.customerId} marked paid` });
  res.json({ ok: true });
});

export default router;
