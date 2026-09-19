"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = logActivity;
const db_1 = __importDefault(require("./db"));
async function logActivity(input) {
    const user = await db_1.default.user.findUnique({
        where: { id: input.userId },
        select: { name: true, email: true },
    });
    const label = [user?.name, user?.email].filter(Boolean).join(" - ");
    await db_1.default.activityLog.create({
        data: {
            userId: input.userId,
            userLabel: label || null,
            action: input.action,
            entity: input.entity,
            entityId: input.entityId,
            detail: input.detail,
        },
    });
}
