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
router.get("/", auth_1.requireAuth, async (req, res) => {
    const quotations = await db_1.default.quotation.findMany({
        where: { userId: req.userId },
        include: { customer: true, items: true },
        orderBy: { date: "desc" },
    });
    res.json(quotations.map((q) => ({ ...q, total: q.items.reduce((s, i) => s + i.amount, 0) })));
});
router.get("/:id", auth_1.requireAuth, async (req, res) => {
    const quotation = await db_1.default.quotation.findUnique({
        where: { id: req.params.id },
        include: { customer: true, items: true },
    });
    if (!quotation) {
        res.json(null);
        return;
    }
    res.json({ ...quotation, total: quotation.items.reduce((s, i) => s + i.amount, 0) });
});
router.post("/", auth_1.requireAuth, async (req, res) => {
    const { customerId, date, validUntil, note, items } = req.body;
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
    const quotation = await db_1.default.quotation.create({
        data: {
            userId: req.userId,
            customerId,
            number: await nextNumber(req.userId, "quote_seq", "QUO"),
            date,
            validUntil,
            note,
            items: { create: normalized },
        },
        include: { customer: true, items: true },
    });
    await (0, activity_1.logActivity)({ userId: req.userId, action: "quotation.created", entity: "quotation", entityId: quotation.id, detail: `Quotation ${quotation.number} created for ${quotation.customer?.username ?? quotation.customerId}` });
    res.json(quotation);
});
router.put("/:id", auth_1.requireAuth, async (req, res) => {
    const { customerId, date, validUntil, note, items } = req.body;
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
    const quotation = await db_1.default.quotation.update({
        where: { id: req.params.id },
        data: {
            customerId,
            date,
            validUntil,
            note,
            items: { deleteMany: {}, create: normalized },
        },
        include: { customer: true, items: true },
    });
    await (0, activity_1.logActivity)({ userId: req.userId, action: "quotation.updated", entity: "quotation", entityId: quotation.id, detail: `Quotation ${quotation.number} updated` });
    res.json(quotation);
});
router.delete("/:id", auth_1.requireAuth, async (req, res) => {
    const quotation = await db_1.default.quotation.findUnique({ where: { id: req.params.id } });
    await db_1.default.quotation.delete({ where: { id: req.params.id } });
    if (quotation) {
        await (0, activity_1.logActivity)({ userId: req.userId, action: "quotation.deleted", entity: "quotation", entityId: quotation.id, detail: `Quotation ${quotation.number} deleted` });
    }
    res.json({ ok: true });
});
router.post("/:id/status", auth_1.requireAuth, async (req, res) => {
    const { status } = req.body;
    const quotation = await db_1.default.quotation.update({
        where: { id: req.params.id },
        data: { status },
    });
    await (0, activity_1.logActivity)({ userId: req.userId, action: "quotation.status_changed", entity: "quotation", entityId: quotation.id, detail: `Quotation ${quotation.number} set to ${status}` });
    res.json(quotation);
});
exports.default = router;
