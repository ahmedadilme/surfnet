import { Router, Request, Response } from "express";
import prisma from "../db";
import { hashPassword, verifyPassword, signToken } from "../auth";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  res.json(user);
});

router.get("/needs-bootstrap", async (_req: Request, res: Response) => {
  const count = await prisma.user.count();
  res.json(count === 0);
});

router.post("/bootstrap", async (req: Request, res: Response) => {
  const count = await prisma.user.count();
  if (count > 0) {
    res.status(400).json({ error: "Bootstrap already completed" });
    return;
  }
  const { email, password, name } = req.body;
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name, role: "admin", passwordHash },
  });
  const token = signToken({ userId: user.id, role: "admin" });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400000 });
  res.json({ user, token });
});

router.post("/sign-in", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = signToken({ userId: user.id, role: user.role });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400000 });
  res.json({ user, token });
});

router.post("/sign-out", (_req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

router.get("/current-role", requireAuth, async (req: Request, res: Response) => {
  res.json(req.userRole);
});

router.get("/list-users", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

router.post("/create-user", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body;
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name, role, passwordHash },
  });
  res.json(user);
});

router.delete("/:userId", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  if (req.params.userId === req.userId) {
    res.status(400).json({ error: "Cannot remove yourself" });
    return;
  }
  await prisma.user.delete({ where: { id: req.params.userId } });
  res.json({ ok: true });
});

export default router;
