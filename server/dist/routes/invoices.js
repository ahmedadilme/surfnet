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
async function nextNumber(userId, seqKey, prefix) {
    const row = await db_1.default.setting.findUnique({ where: { userId_key: { userId, key: seqKey } } });
    const next = (parseInt(row?.value ?? "0", 10) || 0) + 1;
    await db_1.default.setting.upsert({
        where: { userId_key: { userId, key: seqKey } },
        update: { value: String(next) },
        create: { userId, key: seqKey, value: String(next) },
    });
    return `${prefix}-${String(next).padStart(4, "0")}`;
}
router.get("/unpaid-totals/all", auth_1.requireAuth, async (req, res) => {
    const invoices = await db_1.default.invoice.findMany({ where: { userId: req.userId, paid: false }, include: { items: true } });
    const totals = {};
    for (const inv of invoices)
        totals[inv.customerId] = (totals[inv.customerId] ?? 0) + inv.items.reduce((s, i) => s + i.amount, 0);
    res.json(totals);
});
router.get("/", auth_1.requireAuth, async (req, res) => {
    const invoices = await db_1.default.invoice.findMany({
        where: { userId: req.userId },
        include: { customer: true, items: true },
        orderBy: { date: "desc" },
    });
    res.json(invoices.map((inv) => ({ ...inv, total: inv.items.reduce((s, i) => s + i.amount, 0) })));
});
router.get("/:id", auth_1.requireAuth, async (req, res) => {
    const invoice = await db_1.default.invoice.findUnique({
        where: { id: req.params.id },
        include: { customer: true, items: true },
    });
    if (!invoice) {
        res.json(null);
        return;
    }
    res.json({ ...invoice, total: invoice.items.reduce((s, i) => s + i.amount, 0) });
});
router.post("/", auth_1.requireAuth, async (req, res) => {
    const { customerId, date, note, items } = req.body;
    const normalized = (items ?? []).map((it) => {
        const quantity = Math.max(1, Math.floor(Number(it.quantity) || 1));
        const unitPrice = Number(it.unitPrice) || 0;
        return {
            description: it.description ?? "",
            quantity,
            unitPrice,
            amount: Math.round(quantity * unitPrice * 100) / 100,
        };
    }).filter((it) => it.description.trim() !== "");
    const invoice = await db_1.default.invoice.create({
        data: {
            userId: req.userId,
            customerId,
            number: await nextNumber(req.userId, "invoice_seq", "INV"),
            date,
            note,
            items: { create: normalized },
        },
        include: { customer: true, items: true },
    });
    const total = invoice.items.reduce((s, i) => s + i.amount, 0);
    await (0, activity_1.logActivity)({ userId: req.userId, action: "invoice.created", entity: "invoice", entityId: invoice.id, detail: `Invoice ${invoice.number} (${total}) created for ${invoice.customer?.username ?? invoice.customerId}` });
    res.json(invoice);
});
router.put("/:id", auth_1.requireAuth, async (req, res) => {
    const { customerId, date, note, items } = req.body;
    const normalized = (items ?? []).map((it) => {
        const quantity = Math.max(1, Math.floor(Number(it.quantity) || 1));
        const unitPrice = Number(it.unitPrice) || 0;
        return {
            description: it.description ?? "",
            quantity,
            unitPrice,
            amount: Math.round(quantity * unitPrice * 100) / 100,
        };
    }).filter((it) => it.description.trim() !== "");
    const invoice = await db_1.default.invoice.update({
        where: { id: req.params.id },
        data: {
            customerId,
            date,
            note,
            items: { deleteMany: {}, create: normalized },
        },
        include: { customer: true, items: true },
    });
    await (0, activity_1.logActivity)({ userId: req.userId, action: "invoice.updated", entity: "invoice", entityId: invoice.id, detail: `Invoice ${invoice.number} updated` });
    res.json(invoice);
});
router.delete("/:id", auth_1.requireAuth, async (req, res) => {
    const invoice = await db_1.default.invoice.findUnique({ where: { id: req.params.id } });
    await db_1.default.invoice.delete({ where: { id: req.params.id } });
    if (invoice) {
        await (0, activity_1.logActivity)({ userId: req.userId, action: "invoice.deleted", entity: "invoice", entityId: invoice.id, detail: `Invoice ${invoice.number} deleted` });
    }
    res.json({ ok: true });
});
router.post("/:id/mark-paid", auth_1.requireAuth, async (req, res) => {
    const { paymentDate, paymentNote } = req.body;
    const invoice = await db_1.default.invoice.findUnique({
        where: { id: req.params.id },
        include: { items: true },
    });
    if (!invoice) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    await db_1.default.$transaction([
        db_1.default.invoice.update({ where: { id: req.params.id }, data: { paid: true } }),
        db_1.default.payment.create({
            data: {
                userId: req.userId,
                customerId: invoice.customerId,
                invoiceId: invoice.id,
                amount: invoice.items.reduce((s, i) => s + i.amount, 0),
                date: paymentDate,
                note: paymentNote,
            },
        }),
    ]);
    await (0, activity_1.logActivity)({ userId: req.userId, action: "invoice.marked_paid", entity: "invoice", entityId: invoice.id, detail: `Invoice ${invoice.number} marked paid` });
    res.json({ ok: true });
});
exports.default = router;
