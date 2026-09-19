"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/", auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "500"), 10) || 500, 2000);
    const logs = await db_1.default.activityLog.findMany({
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
    res.json(logs);
});
exports.default = router;
