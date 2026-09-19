import { Router, Request, Response } from "express";
import prisma from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const packages = await prisma.package.findMany({
    where: { userId: req.userId },
    orderBy: { name: "asc" },
  });
  res.json(packages);
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { name, price, speed, durationDays, description } = req.body;
  const pkg = await prisma.package.create({
    data: { userId: req.userId!, name, price, speed, durationDays, description },
  });
  res.json(pkg);
});

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const { name, price, speed, durationDays, description } = req.body;
  const pkg = await prisma.package.update({
    where: { id: req.params.id },
    data: { name, price, speed, durationDays, description },
  });
  res.json(pkg);
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  await prisma.package.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
