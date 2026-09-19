import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import customerRoutes from "./routes/customers";
import packageRoutes from "./routes/packages";
import rechargeRoutes from "./routes/recharges";
import paymentRoutes from "./routes/payments";
import expenseRoutes from "./routes/expenses";
import invoiceRoutes from "./routes/invoices";
import quotationRoutes from "./routes/quotations";
import activityRoutes from "./routes/activity";
import settingRoutes from "./routes/settings";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Transform Prisma `id` to `_id` for frontend compatibility
function transformId(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(transformId);
  if (obj && typeof obj === "object") {
    const mapped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "id") mapped["_id"] = v;
      mapped[k] = v;
    }
    return mapped;
  }
  return obj;
}
const originalJson = express.response.json;
express.response.json = function (body: unknown) {
  return originalJson.call(this, transformId(body));
};

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/recharges", rechargeRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/settings", settingRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
