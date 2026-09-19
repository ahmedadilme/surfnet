import { Router, Request, Response } from "express";
import prisma from "../db";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../activity";

const router = Router();

async function nextNumber(userId: string, seqKey: string, prefix: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { userId_key: { userId, key: seqKey } } });
  const next = (parseInt(row?.value ?? "0", 10) || 0) + 1;
  await prisma.setting.upsert({
    where: { userId_key: { userId, key: seqKey } },
    update: { value: String(next) },
    create: { userId, key: seqKey, value: String(next) },
  });
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

router.get("/unpaid-totals/all", requireAuth, async (req: Request, res: Response) => {
  const invoices = await prisma.invoice.findMany({ where: { userId: req.userId, paid: false }, include: { items: true } });
  const totals: Record<string, number> = {};
  for (const inv of invoices) totals[inv.customerId] = (totals[inv.customerId] ?? 0) + inv.items.reduce((s, i) => s + i.amount, 0);
  res.json(totals);
});

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const invoices = await prisma.invoice.findMany({
    where: { userId: req.userId },
    include: { customer: true, items: true },
    orderBy: { date: "desc" },
  });
  res.json(invoices.map((inv) => ({ ...inv, total: inv.items.reduce((s, i) => s + i.amount, 0) })));
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { customer: true, items: true },
  });
  if (!invoice) { res.json(null); return; }
  res.json({ ...invoice, total: invoice.items.reduce((s, i) => s + i.amount, 0) });
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { customerId, date, note, items } = req.body;
  const normalized = (items ?? []).map((it: { description?: string; quantity?: number; unitPrice?: number }) => {
    const quantity = Math.max(1, Math.floor(Number(it.quantity) || 1));
    const unitPrice = Number(it.unitPrice) || 0;
    return {
      description: it.description ?? "",
      quantity,
      unitPrice,
      amount: Math.round(quantity * unitPrice * 100) / 100,
    };
  }).filter((it: { description: string }) => it.description.trim() !== "");

  const invoice = await prisma.invoice.create({
    data: {
      userId: req.userId!,
      customerId,
      number: await nextNumber(req.userId!, "invoice_seq", "INV"),
      date,
      note,
      items: { create: normalized },
    },
    include: { customer: true, items: true },
  });
  const total = invoice.items.reduce((s, i) => s + i.amount, 0);
  await logActivity({ userId: req.userId!, action: "invoice.created", entity: "invoice", entityId: invoice.id, detail: `Invoice ${invoice.number} (${total}) created for ${invoice.customer?.username ?? invoice.customerId}` });
  res.json(invoice);
});

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const { customerId, date, note, items } = req.body;
  const normalized = (items ?? []).map((it: { description?: string; quantity?: number; unitPrice?: number }) => {
    const quantity = Math.max(1, Math.floor(Number(it.quantity) || 1));
    const unitPrice = Number(it.unitPrice) || 0;
    return {
      description: it.description ?? "",
      quantity,
      unitPrice,
      amount: Math.round(quantity * unitPrice * 100) / 100,
    };
  }).filter((it: { description: string }) => it.description.trim() !== "");

  const invoice = await prisma.invoice.update({
    where: { id: req.params.id },
    data: {
      customerId,
      date,
      note,
      items: { deleteMany: {}, create: normalized },
    },
    include: { customer: true, items: true },
  });
  await logActivity({ userId: req.userId!, action: "invoice.updated", entity: "invoice", entityId: invoice.id, detail: `Invoice ${invoice.number} updated` });
  res.json(invoice);
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  await prisma.invoice.delete({ where: { id: req.params.id } });
  if (invoice) {
    await logActivity({ userId: req.userId!, action: "invoice.deleted", entity: "invoice", entityId: invoice.id, detail: `Invoice ${invoice.number} deleted` });
  }
  res.json({ ok: true });
});

router.post("/:id/mark-paid", requireAuth, async (req: Request, res: Response) => {
  const { paymentDate, paymentNote } = req.body;
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!invoice) { res.status(404).json({ error: "Not found" }); return; }
  await prisma.$transaction([
    prisma.invoice.update({ where: { id: req.params.id }, data: { paid: true } }),
    prisma.payment.create({
      data: {
        userId: req.userId!,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        amount: invoice.items.reduce((s, i) => s + i.amount, 0),
        date: paymentDate,
        note: paymentNote,
      },
    }),
  ]);
  await logActivity({ userId: req.userId!, action: "invoice.marked_paid", entity: "invoice", entityId: invoice.id, detail: `Invoice ${invoice.number} marked paid` });
  res.json({ ok: true });
});

export default router;