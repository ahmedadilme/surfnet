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
// Specific routes must come before /:id
router.get("/stats/all", auth_1.requireAuth, async (req, res) => {
    const recharges = await db_1.default.recharge.findMany({ where: { userId: req.userId } });
    const totalBilled = recharges.reduce((s, r) => s + r.amount, 0);
    const totalPaid = recharges.filter((r) => r.paid).reduce((s, r) => s + r.amount, 0);
    res.json({ totalBilled, totalPaid, totalUnpaid: totalBilled - totalPaid, unpaidCount: recharges.filter((r) => !r.paid).length });
});
router.get("/unpaid-totals/all", auth_1.requireAuth, async (req, res) => {
    const recharges = await db_1.default.recharge.findMany({ where: { userId: req.userId, paid: false } });
    const totals = {};
    for (const r of recharges)
        totals[r.customerId] = (totals[r.customerId] ?? 0) + r.amount;
    res.json(totals);
});
router.get("/monthly/all", auth_1.requireAuth, async (req, res) => {
    const recharges = await db_1.default.recharge.findMany({ where: { userId: req.userId } });
    const byMonth = {};
    for (const r of recharges) {
        const month = r.date.slice(0, 7);
        if (!byMonth[month])
            byMonth[month] = { billed: 0, collected: 0 };
        byMonth[month].billed += r.amount;
        if (r.paid)
            byMonth[month].collected += r.amount;
    }
    res.json(Object.entries(byMonth).map(([month, data]) => ({ month, ...data })).sort((a, b) => a.month.localeCompare(b.month)));
});
router.post("/mark-many-paid", auth_1.requireAuth, async (req, res) => {
    const { rechargeIds, paymentDate, paymentNote } = req.body;
    let count = 0;
    for (const id of rechargeIds) {
        const recharge = await db_1.default.recharge.findUnique({ where: { id } });
        if (!recharge || recharge.paid)
            continue;
        await db_1.default.recharge.update({ where: { id }, data: { paid: true } });
        await db_1.default.payment.create({
            data: { userId: req.userId, customerId: recharge.customerId, rechargeId: id, amount: recharge.amount, date: paymentDate, note: paymentNote },
        });
        count++;
    }
    if (count > 0) {
        await (0, activity_1.logActivity)({ userId: req.userId, action: "recharge.marked_many_paid", entity: "recharge", detail: `${count} recharge(s) marked paid` });
    }
    res.json({ ok: true });
});
router.get("/customer/:customerId", auth_1.requireAuth, async (req, res) => {
    const recharges = await db_1.default.recharge.findMany({
        where: { customerId: req.params.customerId },
        include: { package: true },
        orderBy: { date: "desc" },
    });
    res.json(recharges);
});
router.get("/", auth_1.requireAuth, async (req, res) => {
    const recharges = await db_1.default.recharge.findMany({
        where: { userId: req.userId },
        include: { customer: true, package: true },
        orderBy: { date: "desc" },
    });
    res.json(recharges);
});
router.get("/:id", auth_1.requireAuth, async (req, res) => {
    const recharge = await db_1.default.recharge.findUnique({
        where: { id: req.params.id },
        include: { customer: true, package: true },
    });
    res.json(recharge);
});
router.post("/", auth_1.requireAuth, async (req, res) => {
    const { customerId, packageId, amount, date, note } = req.body;
    const recharge = await db_1.default.recharge.create({
        data: { userId: req.userId, customerId, packageId, amount, date, note, paid: false },
    });
    const customer = await db_1.default.customer.findUnique({ where: { id: customerId }, select: { username: true } });
    const pkg = await db_1.default.package.findUnique({ where: { id: packageId }, select: { name: true } });
    await (0, activity_1.logActivity)({ userId: req.userId, action: "recharge.created", entity: "recharge", entityId: recharge.id, detail: `Recharge of ${amount} for ${customer?.username ?? customerId} (${pkg?.name ?? packageId}) recorded` });
    res.json(recharge);
});
router.put("/:id", auth_1.requireAuth, async (req, res) => {
    const { packageId, amount, date, note } = req.body;
    const recharge = await db_1.default.recharge.update({
        where: { id: req.params.id },
        data: { packageId, amount, date, note },
    });
    await (0, activity_1.logActivity)({ userId: req.userId, action: "recharge.updated", entity: "recharge", entityId: recharge.id, detail: `Recharge ${recharge.id} updated` });
    res.json(recharge);
});
router.delete("/:id", auth_1.requireAuth, async (req, res) => {
    const recharge = await db_1.default.recharge.findUnique({ where: { id: req.params.id } });
    await db_1.default.recharge.delete({ where: { id: req.params.id } });
    if (recharge) {
        await (0, activity_1.logActivity)({ userId: req.userId, action: "recharge.deleted", entity: "recharge", entityId: recharge.id, detail: `Recharge ${recharge.id} deleted` });
    }
    res.json({ ok: true });
});
router.post("/:id/mark-paid", auth_1.requireAuth, async (req, res) => {
    const { paymentDate, paymentNote } = req.body;
    const recharge = await db_1.default.recharge.findUnique({ where: { id: req.params.id } });
    if (!recharge) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    await db_1.default.recharge.update({ where: { id: req.params.id }, data: { paid: true } });
    await db_1.default.payment.create({
        data: { userId: req.userId, customerId: recharge.customerId, rechargeId: recharge.id, amount: recharge.amount, date: paymentDate, note: paymentNote },
    });
    const customer = await db_1.default.customer.findUnique({ where: { id: recharge.customerId }, select: { username: true } });
    await (0, activity_1.logActivity)({ userId: req.userId, action: "recharge.marked_paid", entity: "recharge", entityId: recharge.id, detail: `Recharge of ${recharge.amount} for ${customer?.username ?? recharge.customerId} marked paid` });
    res.json({ ok: true });
});
exports.default = router;
