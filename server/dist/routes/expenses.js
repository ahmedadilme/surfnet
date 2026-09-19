"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/stats/all", auth_1.requireAuth, async (req, res) => {
    const expenses = await db_1.default.expense.findMany({ where: { userId: req.userId } });
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const byCategory = {};
    for (const e of expenses)
        byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    res.json({ totalExpenses, byCategory });
});
router.get("/monthly/all", auth_1.requireAuth, async (req, res) => {
    const expenses = await db_1.default.expense.findMany({ where: { userId: req.userId } });
    const byMonth = {};
    for (const e of expenses) {
        const month = e.date.slice(0, 7);
        byMonth[month] = (byMonth[month] ?? 0) + e.amount;
    }
    res.json(Object.entries(byMonth).map(([month, total]) => ({ month, total })).sort((a, b) => a.month.localeCompare(b.month)));
});
router.get("/", auth_1.requireAuth, async (req, res) => {
    const expenses = await db_1.default.expense.findMany({
        where: { userId: req.userId },
        orderBy: { date: "desc" },
    });
    res.json(expenses);
});
router.post("/", auth_1.requireAuth, async (req, res) => {
    const { description, amount, category, date, note } = req.body;
    const expense = await db_1.default.expense.create({
        data: { userId: req.userId, description, amount, category, date, note },
    });
    res.json(expense);
});
router.put("/:id", auth_1.requireAuth, async (req, res) => {
    const { description, amount, category, date, note } = req.body;
    const expense = await db_1.default.expense.update({
        where: { id: req.params.id },
        data: { description, amount, category, date, note },
    });
    res.json(expense);
});
router.delete("/:id", auth_1.requireAuth, async (req, res) => {
    await db_1.default.expense.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
});
exports.default = router;
