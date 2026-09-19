"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_1 = __importDefault(require("./routes/auth"));
const customers_1 = __importDefault(require("./routes/customers"));
const packages_1 = __importDefault(require("./routes/packages"));
const recharges_1 = __importDefault(require("./routes/recharges"));
const payments_1 = __importDefault(require("./routes/payments"));
const expenses_1 = __importDefault(require("./routes/expenses"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const quotations_1 = __importDefault(require("./routes/quotations"));
const activity_1 = __importDefault(require("./routes/activity"));
const settings_1 = __importDefault(require("./routes/settings"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// Transform Prisma `id` to `_id` for frontend compatibility
function transformId(obj) {
    if (Array.isArray(obj))
        return obj.map(transformId);
    if (obj && typeof obj === "object") {
        const mapped = {};
        for (const [k, v] of Object.entries(obj)) {
            if (k === "id")
                mapped["_id"] = v;
            mapped[k] = v;
        }
        return mapped;
    }
    return obj;
}
const originalJson = express_1.default.response.json;
express_1.default.response.json = function (body) {
    return originalJson.call(this, transformId(body));
};
app.use("/api/auth", auth_1.default);
app.use("/api/customers", customers_1.default);
app.use("/api/packages", packages_1.default);
app.use("/api/recharges", recharges_1.default);
app.use("/api/payments", payments_1.default);
app.use("/api/expenses", expenses_1.default);
app.use("/api/invoices", invoices_1.default);
app.use("/api/quotations", quotations_1.default);
app.use("/api/activity", activity_1.default);
app.use("/api/settings", settings_1.default);
app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
