import { Router, Request, Response } from "express";
import prisma from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/customer/:customerId", requireAuth, async (req: Request, res: Response) => {
  const payments = await prisma.payment.findMany({
    where: { customerId: req.params.customerId },
    orderBy: { date: "desc" },
  });
  res.json(payments);
});

export default router;
