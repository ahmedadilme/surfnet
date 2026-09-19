"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/customer/:customerId", auth_1.requireAuth, async (req, res) => {
    const payments = await db_1.default.payment.findMany({
        where: { customerId: req.params.customerId },
        orderBy: { date: "desc" },
    });
    res.json(payments);
});
exports.default = router;
