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
const round = (n) => Math.round(n * 100) / 100;
router.get("/", auth_1.requireAuth, async (req, res) => {
    const payments = await db_1.default.payment.findMany({
        where: { userId: req.userId },
        include: {
            customer: { select: { username: true, name: true } },
            invoice: { select: { number: true } },
            recharge: true,
        },
        orderBy: { date: "desc" },
    });
    res.json(payments.map((p) => ({
        ...p,
        type: p.invoice ? "Invoice" : "Recharge",
        reference: p.invoice?.number ?? p.rechargeId,
    })));
});
router.get("/customer/:customerId", auth_1.requireAuth, async (req, res) => {
    const payments = await db_1.default.payment.findMany({
        where: { customerId: req.params.customerId },
        orderBy: { date: "desc" },
    });
    res.json(payments);
});
router.delete("/:id", auth_1.requireAuth, async (req, res) => {
    const payment = await db_1.default.payment.findUnique({
        where: { id: req.params.id },
        include: {
            invoice: { include: { items: true } },
            recharge: true,
            customer: { select: { username: true } },
        },
    });
    if (!payment) {
        res.status(404).json({ error: "Payment not found" });
        return;
    }
    await db_1.default.$transaction(async (tx) => {
        await tx.payment.delete({ where: { id: req.params.id } });
        if (payment.invoiceId) {
            const invoice = payment.invoice;
            const total = round(invoice.items.reduce((s, i) => s + i.amount, 0));
            const newPaidAmount = round(Math.max((invoice.amountPaid || 0) - payment.amount, 0));
            const fullyPaid = round(total - newPaidAmount) <= 0;
            await tx.invoice.update({
                where: { id: payment.invoiceId },
                data: { amountPaid: newPaidAmount, paid: fullyPaid },
            });
        }
        else if (payment.rechargeId) {
            const recharge = payment.recharge;
            const newPaidAmount = round(Math.max((recharge.amountPaid || 0) - payment.amount, 0));
            const fullyPaid = round(recharge.amount - newPaidAmount) <= 0;
            await tx.recharge.update({
                where: { id: payment.rechargeId },
                data: { amountPaid: newPaidAmount, paid: fullyPaid },
            });
        }
    });
    const who = payment.invoice
        ? `invoice ${payment.invoice.number}`
        : payment.recharge
            ? `recharge for ${payment.customer?.username ?? payment.rechargeId}`
            : "unknown";
    await (0, activity_1.logActivity)({
        userId: req.userId,
        action: "payment.deleted",
        entity: "payment",
        entityId: payment.id,
        detail: `Payment of ${payment.amount} removed from ${who}`,
    });
    res.json({ ok: true });
});
exports.default = router;
