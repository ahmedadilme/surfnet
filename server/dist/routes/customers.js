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
    const customers = await db_1.default.customer.findMany({
        where: { userId: req.userId },
        orderBy: { username: "asc" },
    });
    res.json(customers);
});
router.get("/:id", auth_1.requireAuth, async (req, res) => {
    const customer = await db_1.default.customer.findUnique({ where: { id: req.params.id } });
    res.json(customer);
});
router.post("/", auth_1.requireAuth, async (req, res) => {
    const { username, name, phone, address } = req.body;
    const customer = await db_1.default.customer.create({
        data: { userId: req.userId, username, name, phone, address },
    });
    res.json(customer);
});
router.put("/:id", auth_1.requireAuth, async (req, res) => {
    const { username, name, phone, address } = req.body;
    const customer = await db_1.default.customer.update({
        where: { id: req.params.id },
        data: { username, name, phone, address },
    });
    res.json(customer);
});
router.delete("/:id", auth_1.requireAuth, async (req, res) => {
    await db_1.default.customer.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
});
exports.default = router;
