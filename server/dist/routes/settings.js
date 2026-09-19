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
const DEFAULTS = {
    ispName: "My ISP",
    ispTagline: "Reliable Internet Services",
    ispPhone: "",
    ispEmail: "",
    ispAddress: "",
    logoUrl: "",
    currency: "USD",
    currencySymbol: "$",
    currencyPosition: "before",
};
router.get("/", auth_1.requireAuth, async (req, res) => {
    const rows = await db_1.default.setting.findMany({ where: { userId: req.userId } });
    const map = { ...DEFAULTS };
    for (const row of rows)
        map[row.key] = row.value;
    res.json(map);
});
router.post("/set-many", auth_1.requireAuth, async (req, res) => {
    const { entries } = req.body;
    for (const { key, value } of entries) {
        await db_1.default.setting.upsert({
            where: { userId_key: { userId: req.userId, key } },
            update: { value },
            create: { userId: req.userId, key, value },
        });
    }
    await (0, activity_1.logActivity)({ userId: req.userId, action: "settings.updated", entity: "settings", detail: `Settings updated (${entries.length} key${entries.length === 1 ? "" : "s"}): ${entries.map((e) => e.key).join(", ")}` });
    res.json({ ok: true });
});
exports.default = router;
