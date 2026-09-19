import { Router, Request, Response } from "express";
import prisma from "../db";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../activity";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const customers = await prisma.customer.findMany({
    where: { userId: req.userId },
    orderBy: { username: "asc" },
  });
  res.json(customers);
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  res.json(customer);
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { username, name, phone, address } = req.body;
  const customer = await prisma.customer.create({
    data: { userId: req.userId!, username, name, phone, address },
  });
  await logActivity({ userId: req.userId!, action: "customer.created", entity: "customer", entityId: customer.id, detail: `Customer ${username} (${name}) created` });
  res.json(customer);
});

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const { username, name, phone, address } = req.body;
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: { username, name, phone, address },
  });
  await logActivity({ userId: req.userId!, action: "customer.updated", entity: "customer", entityId: customer.id, detail: `Customer ${customer.username} (${customer.name}) updated` });
  res.json(customer);
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  await prisma.customer.delete({ where: { id: req.params.id } });
  if (customer) {
    await logActivity({ userId: req.userId!, action: "customer.deleted", entity: "customer", entityId: req.params.id, detail: `Customer ${customer.username} (${customer.name}) deleted` });
  }
  res.json({ ok: true });
});

export default router;
