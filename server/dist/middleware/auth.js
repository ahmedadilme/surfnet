"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const auth_1 = require("../auth");
function requireAuth(req, res, next) {
    const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
        res.status(401).json({ error: "Not authenticated" });
        return;
    }
    const payload = (0, auth_1.verifyToken)(token);
    if (!payload) {
        res.status(401).json({ error: "Invalid token" });
        return;
    }
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
}
function requireAdmin(req, res, next) {
    if (req.userRole !== "admin") {
        res.status(403).json({ error: "Not authorized" });
        return;
    }
    next();
}
