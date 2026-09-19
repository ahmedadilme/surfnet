import { Router, Request, Response } from "express";
import prisma from "../db";
import { requireAuth } from "../middleware/auth";

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
  res.json(customer);
});

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const { username, name, phone, address } = req.body;
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: { username, name, phone, address },
  });
  res.json(customer);
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  await prisma.customer.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
