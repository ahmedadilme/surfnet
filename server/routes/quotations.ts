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

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const quotations = await prisma.quotation.findMany({
    where: { userId: req.userId },
    include: { customer: true, items: true },
    orderBy: { date: "desc" },
  });
  res.json(quotations.map((q) => ({ ...q, total: q.items.reduce((s, i) => s + i.amount, 0) })));
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: req.params.id },
    include: { customer: true, items: true },
  });
  if (!quotation) { res.json(null); return; }
  res.json({ ...quotation, total: quotation.items.reduce((s, i) => s + i.amount, 0) });
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { customerId, date, validUntil, note, items } = req.body;
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

  const quotation = await prisma.quotation.create({
    data: {
      userId: req.userId!,
      customerId,
      number: await nextNumber(req.userId!, "quote_seq", "QUO"),
      date,
      validUntil,
      note,
      items: { create: normalized },
    },
    include: { customer: true, items: true },
  });
  await logActivity({ userId: req.userId!, action: "quotation.created", entity: "quotation", entityId: quotation.id, detail: `Quotation ${quotation.number} created for ${quotation.customer?.username ?? quotation.customerId}` });
  res.json(quotation);
});

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const { customerId, date, validUntil, note, items } = req.body;
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

  const quotation = await prisma.quotation.update({
    where: { id: req.params.id },
    data: {
      customerId,
      date,
      validUntil,
      note,
      items: { deleteMany: {}, create: normalized },
    },
    include: { customer: true, items: true },
  });
  await logActivity({ userId: req.userId!, action: "quotation.updated", entity: "quotation", entityId: quotation.id, detail: `Quotation ${quotation.number} updated` });
  res.json(quotation);
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const quotation = await prisma.quotation.findUnique({ where: { id: req.params.id } });
  await prisma.quotation.delete({ where: { id: req.params.id } });
  if (quotation) {
    await logActivity({ userId: req.userId!, action: "quotation.deleted", entity: "quotation", entityId: quotation.id, detail: `Quotation ${quotation.number} deleted` });
  }
  res.json({ ok: true });
});

router.post("/:id/status", requireAuth, async (req: Request, res: Response) => {
  const { status } = req.body;
  const quotation = await prisma.quotation.update({
    where: { id: req.params.id },
    data: { status },
  });
  await logActivity({ userId: req.userId!, action: "quotation.status_changed", entity: "quotation", entityId: quotation.id, detail: `Quotation ${quotation.number} set to ${status}` });
  res.json(quotation);
});

export default router;