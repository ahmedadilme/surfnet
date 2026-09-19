import { Router, Request, Response } from "express";
import prisma from "../db";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../activity";

const router = Router();

const round = (n: number) => Math.round(n * 100) / 100;

router.get("/customer/:customerId", requireAuth, async (req: Request, res: Response) => {
  const payments = await prisma.payment.findMany({
    where: { customerId: req.params.customerId },
    orderBy: { date: "desc" },
  });
  res.json(payments);
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const payment = await prisma.payment.findUnique({
    where: { id: req.params.id },
    include: {
      invoice: { include: { items: true } },
      recharge: true,
      customer: { select: { username: true } },
    },
  });
  if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }

  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: req.params.id } });

    if (payment.invoiceId) {
      const invoice = payment.invoice!;
      const total = round(invoice.items.reduce((s, i) => s + i.amount, 0));
      const newPaidAmount = round(Math.max((invoice.amountPaid || 0) - payment.amount, 0));
      const fullyPaid = round(total - newPaidAmount) <= 0;
      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { amountPaid: newPaidAmount, paid: fullyPaid },
      });
    } else if (payment.rechargeId) {
      const recharge = payment.recharge!;
      const newPaidAmount = round(Math.max((recharge.amountPaid || 0) - payment.amount, 0));
      const fullyPaid = round(recharge.amount - newPaidAmount) <= 0;
      await tx.recharge.update({
        where: { id: payment.rechargeId },
        data: { amountPaid: newPaidAmount, paid: fullyPaid },
      });
    }
  });

  const who = payment.invoice
    ? `invoice ${payment.invoice.number}`
    : payment.recharge
      ? `recharge for ${payment.customer?.username ?? payment.rechargeId}`
      : "unknown";
  await logActivity({
    userId: req.userId!,
    action: "payment.deleted",
    entity: "payment",
    entityId: payment.id,
    detail: `Payment of ${payment.amount} removed from ${who}`,
  });
  res.json({ ok: true });
});

export default router;