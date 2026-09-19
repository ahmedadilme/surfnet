import { Router, Request, Response } from "express";
import prisma from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

const DEFAULTS: Record<string, string> = {
  ispName: "My ISP",
  ispTagline: "Reliable Internet Services",
  ispPhone: "",
  ispEmail: "",
  ispAddress: "",
  logoUrl: "",
  currency: "USD",
  currencySymbol: "$",
  currencyPosition: "before",
};

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const rows = await prisma.setting.findMany({ where: { userId: req.userId } });
  const map = { ...DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  res.json(map);
});

router.post("/set-many", requireAuth, async (req: Request, res: Response) => {
  const { entries } = req.body;
  for (const { key, value } of entries) {
    await prisma.setting.upsert({
      where: { userId_key: { userId: req.userId!, key } },
      update: { value },
      create: { userId: req.userId!, key, value },
    });
  }
  res.json({ ok: true });
});

export default router;
