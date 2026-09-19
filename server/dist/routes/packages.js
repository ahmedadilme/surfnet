"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
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
    res.json(pkg);
});
router.put("/:id", auth_1.requireAuth, async (req, res) => {
    const { name, price, speed, durationDays, description } = req.body;
    const pkg = await db_1.default.package.update({
        where: { id: req.params.id },
        data: { name, price, speed, durationDays, description },
    });
    res.json(pkg);
});
router.delete("/:id", auth_1.requireAuth, async (req, res) => {
    await db_1.default.package.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
});
exports.default = router;
