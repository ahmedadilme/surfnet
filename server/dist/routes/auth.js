"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../auth");
const auth_2 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/me", auth_2.requireAuth, async (req, res) => {
    const user = await db_1.default.user.findUnique({ where: { id: req.userId } });
    res.json(user);
});
router.get("/needs-bootstrap", async (_req, res) => {
    const count = await db_1.default.user.count();
    res.json(count === 0);
});
router.post("/bootstrap", async (req, res) => {
    const count = await db_1.default.user.count();
    if (count > 0) {
        res.status(400).json({ error: "Bootstrap already completed" });
        return;
    }
    const { email, password, name } = req.body;
    const passwordHash = await (0, auth_1.hashPassword)(password);
    const user = await db_1.default.user.create({
        data: { email, name, role: "admin", passwordHash },
    });
    const token = (0, auth_1.signToken)({ userId: user.id, role: "admin" });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400000 });
    res.json({ user, token });
});
router.post("/sign-in", async (req, res) => {
    const { email, password } = req.body;
    const user = await db_1.default.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || !(await (0, auth_1.verifyPassword)(password, user.passwordHash))) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
    }
    const token = (0, auth_1.signToken)({ userId: user.id, role: user.role });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 86400000 });
    res.json({ user, token });
});
router.post("/sign-out", (_req, res) => {
    res.clearCookie("token");
    res.json({ ok: true });
});
router.get("/current-role", auth_2.requireAuth, async (req, res) => {
    res.json(req.userRole);
});
router.get("/list-users", auth_2.requireAuth, auth_2.requireAdmin, async (req, res) => {
    const users = await db_1.default.user.findMany();
    res.json(users);
});
router.post("/create-user", auth_2.requireAuth, auth_2.requireAdmin, async (req, res) => {
    const { email, password, name, role } = req.body;
    const passwordHash = await (0, auth_1.hashPassword)(password);
    const user = await db_1.default.user.create({
        data: { email, name, role, passwordHash },
    });
    res.json(user);
});
router.delete("/:userId", auth_2.requireAuth, auth_2.requireAdmin, async (req, res) => {
    if (req.params.userId === req.userId) {
        res.status(400).json({ error: "Cannot remove yourself" });
        return;
    }
    await db_1.default.user.delete({ where: { id: req.params.userId } });
    res.json({ ok: true });
});
exports.default = router;
