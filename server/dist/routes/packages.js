"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const activity_1 = require("../activity");
const router = (0, express_1.Router)();
router.get("/", auth_1.requireAuth, async (req, res) => {
    const packages = await db_1.default.package.findMany({
        where: { userId: req.userId },
        orderBy: { name: "asc" },
    });
    res.json(packages);
});
router.post("/", auth_1.requireAuth, async (req, res) => {
    const { name, price, speed, durationDays, description } = req.body;
    const pkg = await db_1.default.package.create({
        data: { userId: req.userId, name, price, speed, durationDays, description },
    });
    await (0, activity_1.logActivity)({ userId: req.userId, action: "package.created", entity: "package", entityId: pkg.id, detail: `Package ${name} (${price}) created` });
    res.json(pkg);
});
router.put("/:id", auth_1.requireAuth, async (req, res) => {
    const { name, price, speed, durationDays, description } = req.body;
    const pkg = await db_1.default.package.update({
        where: { id: req.params.id },
        data: { name, price, speed, durationDays, description },
    });
    await (0, activity_1.logActivity)({ userId: req.userId, action: "package.updated", entity: "package", entityId: pkg.id, detail: `Package ${name} updated` });
    res.json(pkg);
});
router.delete("/:id", auth_1.requireAuth, async (req, res) => {
    const pkg = await db_1.default.package.findUnique({ where: { id: req.params.id } });
    await db_1.default.package.delete({ where: { id: req.params.id } });
    if (pkg) {
        await (0, activity_1.logActivity)({ userId: req.userId, action: "package.deleted", entity: "package", entityId: req.params.id, detail: `Package ${pkg.name} deleted` });
    }
    res.json({ ok: true });
});
exports.default = router;
