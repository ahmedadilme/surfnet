import { Router, Request, Response } from "express";
import prisma from "../db";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../activity";

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
  await logActivity({ userId: req.userId!, action: "package.created", entity: "package", entityId: pkg.id, detail: `Package ${name} (${price}) created` });
  res.json(pkg);
});

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const { name, price, speed, durationDays, description } = req.body;
  const pkg = await prisma.package.update({
    where: { id: req.params.id },
    data: { name, price, speed, durationDays, description },
  });
  await logActivity({ userId: req.userId!, action: "package.updated", entity: "package", entityId: pkg.id, detail: `Package ${name} updated` });
  res.json(pkg);
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const pkg = await prisma.package.findUnique({ where: { id: req.params.id } });
  await prisma.package.delete({ where: { id: req.params.id } });
  if (pkg) {
    await logActivity({ userId: req.userId!, action: "package.deleted", entity: "package", entityId: req.params.id, detail: `Package ${pkg.name} deleted` });
  }
  res.json({ ok: true });
});

export default router;
