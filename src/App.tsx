import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { DefaultProviders } from "./components/providers/default.tsx";
import { Spinner } from "./components/ui/spinner.tsx";
import { useAuth } from "@/lib/auth-context.tsx";
import AppLayout from "./pages/AppLayout.tsx";
import SignIn from "./pages/auth/SignIn.tsx";
import Index from "./pages/index.tsx";
import CustomersPage from "./pages/customers/page.tsx";
import PackagesPage from "./pages/packages/page.tsx";
import RechargePage from "./pages/recharge/page.tsx";
import PaymentsPage from "./pages/payments/page.tsx";
import StatementPage from "./pages/statement/page.tsx";
import ReceiptPage from "./pages/receipt/page.tsx";
import ExpensesPage from "./pages/expenses/page.tsx";
import InvoicesPage from "./pages/invoices/page.tsx";
import InvoiceViewPage from "./pages/invoice/view.tsx";
import QuotationsPage from "./pages/quotations/page.tsx";
import QuotationViewPage from "./pages/quotation/view.tsx";
import SettingsPage from "./pages/settings/page.tsx";
import AdminPage from "./pages/admin/page.tsx";
import NotFound from "./pages/NotFound.tsx";

const ReportsPage = lazy(() => import("./pages/reports/page.tsx"));

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SignIn />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Index />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/packages" element={<PackagesPage />} />
          <Route path="/recharge" element={<RechargePage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/statement/:customerId" element={<StatementPage />} />
          <Route path="/receipt/:rechargeId" element={<ReceiptPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoice/:invoiceId" element={<InvoiceViewPage />} />
          <Route path="/quotations" element={<QuotationsPage />} />
          <Route path="/quotation/:quotationId" element={<QuotationViewPage />} />
          <Route path="/reports" element={<Suspense fallback={<Spinner className="mx-auto mt-16 size-8" />}><ReportsPage /></Suspense>} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <DefaultProviders>
      <AppContent />
    </DefaultProviders>
  );
}
