import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { toast } from "sonner";
import {
  BarChart3,
  ChevronDown,
  Download,
  FileDown,
  Search,
  Zap,
} from "lucide-react";
import {
  formatDate,
  formatDateTime,
  todayISO,
  downloadCSV,
} from "@/lib/utils.ts";
import { useSettings, formatAmount } from "@/hooks/use-settings.ts";
import { downloadPDF } from "@/lib/export-pdf.ts";

const round = (n: number) => Math.round(n * 100) / 100;

const ALL = "all";
const PAID = "paid";
const UNPAID = "unpaid";
const PARTIAL = "partial";

function inRange(date: string, from: string, to: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

// Recharge.date is a plain YYYY-MM-DD string, but tolerate values that carry a time.
function formatStamp(value: string): string {
  return value.length > 10 ? formatDateTime(value) : formatDate(value);
}

type LedgerRow = {
  date: string;
  customer: string;
  type: string;
  reference: string;
  note: string;
  amount: number;
};

export default function ReportsPage() {
  const settings = useSettings();
  const { data: recharges } = useQuery({ queryKey: ["recharges"], queryFn: () => api.get("/recharges") });
  const { data: invoices } = useQuery({ queryKey: ["invoices"], queryFn: () => api.get("/invoices") });
  const { data: expenses } = useQuery({ queryKey: ["expenses"], queryFn: () => api.get("/expenses") });
  const { data: payments } = useQuery({ queryKey: ["payments"], queryFn: () => api.get("/payments") });

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  const [rDateFrom, setRDateFrom] = useState("");
  const [rDateTo, setRDateTo] = useState("");
  const [rSearch, setRSearch] = useState("");
  const [rCustomer, setRCustomer] = useState(ALL);
  const [rPackage, setRPackage] = useState(ALL);
  const [rStatus, setRStatus] = useState(ALL);
  const [rExportingPdf, setRExportingPdf] = useState(false);

  const ready = recharges !== undefined && invoices !== undefined && expenses !== undefined && payments !== undefined;

  const billed = ready
    ? (recharges ?? []).filter((r) => inRange(r.date, dateFrom, dateTo)).reduce((s, r) => s + r.amount, 0) +
      (invoices ?? []).filter((i) => inRange(i.date, dateFrom, dateTo)).reduce((s, i) => s + i.total, 0)
    : 0;

  const collected = ready
    ? (payments ?? []).filter((p) => inRange(p.date, dateFrom, dateTo)).reduce((s, p) => s + p.amount, 0)
    : 0;

  const expenseTotal = ready
    ? (expenses ?? []).filter((e) => inRange(e.date, dateFrom, dateTo)).reduce((s, e) => s + e.amount, 0)
    : 0;

  const net = round(collected - expenseTotal);

  const outstanding = ready
    ? (recharges ?? []).reduce((s, r) => s + (r.remaining ?? 0), 0) +
      (invoices ?? []).reduce((s, i) => s + (i.remaining ?? 0), 0)
    : 0;

  const ledger: LedgerRow[] = ready
    ? (payments ?? [])
        .filter((p) => inRange(p.date, dateFrom, dateTo))
        .map((p) => ({
          date: p.date,
          customer: p.customer?.username ?? "—",
          type: p.type ?? (p.invoice ? "Invoice" : "Recharge"),
          reference: p.reference ?? p.rechargeId ?? "—",
          note: p.note ?? "",
          amount: p.amount,
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const monthly: { month: string; billed: number; collected: number; expenses: number }[] = (() => {
    if (!ready) return [];
    const map: Record<string, { billed: number; collected: number; expenses: number }> = {};
    for (const r of recharges ?? []) {
      if (!inRange(r.date, dateFrom, dateTo)) continue;
      const m = r.date.slice(0, 7);
      map[m] ??= { billed: 0, collected: 0, expenses: 0 };
      map[m].billed = round(map[m].billed + r.amount);
    }
    for (const i of invoices ?? []) {
      if (!inRange(i.date, dateFrom, dateTo)) continue;
      const m = i.date.slice(0, 7);
      map[m] ??= { billed: 0, collected: 0, expenses: 0 };
      map[m].billed = round(map[m].billed + i.total);
    }
    for (const p of payments ?? []) {
      if (!inRange(p.date, dateFrom, dateTo)) continue;
      const m = p.date.slice(0, 7);
      map[m] ??= { billed: 0, collected: 0, expenses: 0 };
      map[m].collected = round(map[m].collected + p.amount);
    }
    for (const e of expenses ?? []) {
      if (!inRange(e.date, dateFrom, dateTo)) continue;
      const m = e.date.slice(0, 7);
      map[m] ??= { billed: 0, collected: 0, expenses: 0 };
      map[m].expenses = round(map[m].expenses + e.amount);
    }
    return Object.entries(map)
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month));
  })();

  const rangeLabel = dateFrom || dateTo ? `${dateFrom || "—"} to ${dateTo || "—"}` : "All time";

  const rRangeLabel = rDateFrom || rDateTo ? `${rDateFrom || "—"} to ${rDateTo || "—"}` : "All time";

  const rCustomerOptions = Array.from(
    new Set<string>((recharges ?? []).map((r) => r.customer?.username ?? "").filter(Boolean))
  ).sort();
  const rPackageOptions = Array.from(
    new Set<string>((recharges ?? []).map((r) => r.package?.name ?? "").filter(Boolean))
  ).sort();

  const rq = rSearch.toLowerCase();
  const rechargeRows = (recharges ?? [])
    .filter((r) => {
      const remaining = r.remaining ?? r.amount;
      if (!inRange(r.date, rDateFrom, rDateTo)) return false;
      if (rCustomer !== ALL && r.customer?.username !== rCustomer) return false;
      if (rPackage !== ALL && r.package?.name !== rPackage) return false;
      if (rStatus === PAID && remaining > 0) return false;
      if (rStatus === UNPAID && remaining <= 0) return false;
      if (rStatus === PARTIAL && !((r.amountPaid ?? 0) > 0 && remaining > 0)) return false;
      if (
        rq &&
        !`${r.customer?.username ?? ""} ${r.customer?.name ?? ""} ${r.package?.name ?? ""} ${r.note ?? ""}`
          .toLowerCase()
          .includes(rq)
      )
        return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const rechargeTotal = round(rechargeRows.reduce((s, r) => s + r.amount, 0));
  const rechargePaid = round(rechargeRows.reduce((s, r) => s + (r.amountPaid ?? 0), 0));
  const rechargeOutstanding = round(
    rechargeRows.reduce((s, r) => s + (r.remaining ?? r.amount), 0)
  );

  const rechargeSummaryTiles = [
    { label: "Total (Filtered)", value: formatAmount(rechargeTotal, settings), color: "text-primary" },
    { label: "Recharges", value: String(rechargeRows.length), color: "text-muted-foreground" },
    { label: "Total Paid", value: formatAmount(rechargePaid, settings), color: "text-green-600" },
    { label: "Outstanding", value: formatAmount(rechargeOutstanding, settings), color: "text-amber-500" },
  ];

  const summaryTiles = [
    { label: "Total Billed", value: formatAmount(billed, settings), color: "text-primary" },
    { label: "Total Collected", value: formatAmount(collected, settings), color: "text-green-600" },
    { label: "Expenses", value: formatAmount(expenseTotal, settings), color: "text-destructive" },
    { label: "Net (Collected − Expenses)", value: formatAmount(net, settings), color: net >= 0 ? "text-green-600" : "text-destructive" },
    { label: "Outstanding (due now)", value: formatAmount(outstanding, settings), color: "text-amber-500" },
  ];

  const handleCsv = () => {
    if (ledger.length === 0) {
      toast.info("Nothing to export for the selected range");
      return;
    }
    downloadCSV(
      ledger.map((r) => ({
        Date: r.date,
        Customer: r.customer,
        Type: r.type,
        Reference: r.reference,
        Note: r.note,
        Amount: r.amount,
      })),
      `revenue-report-${todayISO()}.csv`
    );
  };

  const handlePdf = () => {
    if (ledger.length === 0) {
      toast.info("Nothing to export for the selected range");
      return;
    }
    setExportingPdf(true);
    try {
      downloadPDF({
        title: `${settings.ispName} — Revenue Report`,
        subtitle: `Generated ${formatDate(todayISO())} · ${rangeLabel}`,
        summary: summaryTiles.map((t) => ({ label: t.label, value: t.value })),
        columns: [
          { header: "Date", dataKey: "date" },
          { header: "Customer", dataKey: "customer" },
          { header: "Type", dataKey: "type" },
          { header: "Reference", dataKey: "reference" },
          { header: "Note", dataKey: "note" },
          { header: "Amount", dataKey: "amount" },
        ],
        rows: ledger.map((r) => ({
          ...r,
          amount: formatAmount(r.amount, settings),
          date: formatDate(r.date),
        })),
        filename: `revenue-report-${todayISO()}.pdf`,
      });
      toast.success("Report exported as PDF!");
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleRechargeCsv = () => {
    if (rechargeRows.length === 0) {
      toast.info("Nothing to export for the selected filters");
      return;
    }
    downloadCSV(
      rechargeRows.map((r) => ({
        Username: r.customer?.username ?? "—",
        Name: r.customer?.name ?? "—",
        Package: r.package?.name ?? "—",
        Date: r.date,
        Price: r.amount,
      })),
      `recharge-report-${todayISO()}.csv`
    );
  };

  const handleRechargePdf = () => {
    if (rechargeRows.length === 0) {
      toast.info("Nothing to export for the selected filters");
      return;
    }
    setRExportingPdf(true);
    try {
      downloadPDF({
        title: `${settings.ispName} — Recharge Report`,
        subtitle: `Generated ${formatDate(todayISO())} · ${rRangeLabel}`,
        summary: rechargeSummaryTiles.map((t) => ({ label: t.label, value: t.value })),
        columns: [
          { header: "Username", dataKey: "username" },
          { header: "Name", dataKey: "name" },
          { header: "Package", dataKey: "package" },
          { header: "Date", dataKey: "date" },
          { header: "Price", dataKey: "price" },
        ],
        rows: rechargeRows.map((r) => ({
          username: r.customer?.username ?? "—",
          name: r.customer?.name ?? "—",
          package: r.package?.name ?? "—",
          date: formatStamp(r.date),
          price: formatAmount(r.amount, settings),
        })),
        filename: `recharge-report-${todayISO()}.pdf`,
      });
      toast.success("Recharge report exported as PDF!");
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setRExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Revenue and collections overview</p>
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">
            <BarChart3 className="w-3.5 h-3.5" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="recharges">
            <Zap className="w-3.5 h-3.5" />
            Recharge Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-28 sm:w-36" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-28 sm:w-36" />
        </div>
        <div className="sm:ml-auto flex gap-2">
          <Button variant="outline" className="cursor-pointer" onClick={handleCsv}>
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button className="cursor-pointer" onClick={handlePdf} disabled={exportingPdf}>
            <FileDown className="w-4 h-4 mr-2" /> {exportingPdf ? "Exporting..." : "PDF"}
          </Button>
        </div>
      </div>

      {!ready ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {summaryTiles.map((t) => (
              <Card key={t.label} className="min-w-0 overflow-hidden">
                <CardContent className="pt-5 min-w-0">
                  <BarChart3 className={t.color} />
                  <p className="text-xl md:text-2xl font-bold break-words leading-tight mt-2">{t.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Monthly breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {monthly.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No data for the selected range.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Month</th>
                        <th className="py-2 pr-4 font-medium text-right">Billed</th>
                        <th className="py-2 pr-4 font-medium text-right">Collected</th>
                        <th className="py-2 font-medium text-right">Expenses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {monthly.map((m) => (
                        <tr key={m.month}>
                          <td className="py-2 pr-4 font-medium">{m.month}</td>
                          <td className="py-2 pr-4 text-right">{formatAmount(m.billed, settings)}</td>
                          <td className="py-2 pr-4 text-right">{formatAmount(m.collected, settings)}</td>
                          <td className="py-2 text-right">{formatAmount(m.expenses, settings)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue ledger */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                Revenue Ledger ({ledger.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ledger.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No payments recorded in the selected range.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Date</th>
                        <th className="py-2 pr-4 font-medium">Customer</th>
                        <th className="py-2 pr-4 font-medium">Type</th>
                        <th className="py-2 pr-4 font-medium">Reference</th>
                        <th className="py-2 pr-4 font-medium">Note</th>
                        <th className="py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ledger.map((r, idx) => (
                        <tr key={idx} className="whitespace-nowrap">
                          <td className="py-2 pr-4">{formatDate(r.date)}</td>
                          <td className="py-2 pr-4 font-medium">{r.customer}</td>
                          <td className="py-2 pr-4">
                            <span className={r.type === "Invoice" ? "text-primary" : "text-foreground"}>{r.type}</span>
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">{r.reference}</td>
                          <td className="py-2 pr-4 text-muted-foreground max-w-40 truncate">{r.note || "—"}</td>
                          <td className="py-2 text-right font-semibold">{formatAmount(r.amount, settings)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
        </TabsContent>

        <TabsContent value="recharges" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col lg:flex-row items-start lg:items-end gap-3">
            <div className="relative w-full lg:w-64">
              <Label className="text-xs">Search</Label>
              <Search className="absolute left-2.5 top-[1.4rem] -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Username, name, package, note..."
                value={rSearch}
                onChange={(e) => setRSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={rDateFrom}
                onChange={(e) => setRDateFrom(e.target.value)}
                className="w-28 sm:w-36"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={rDateTo}
                onChange={(e) => setRDateTo(e.target.value)}
                className="w-28 sm:w-36"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Customer</Label>
              <Select value={rCustomer} onValueChange={setRCustomer}>
                <SelectTrigger className="w-full sm:w-44 h-9 cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All customers</SelectItem>
                  {rCustomerOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Package</Label>
              <Select value={rPackage} onValueChange={setRPackage}>
                <SelectTrigger className="w-full sm:w-44 h-9 cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All packages</SelectItem>
                  {rPackageOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={rStatus} onValueChange={setRStatus}>
                <SelectTrigger className="w-full sm:w-44 h-9 cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  <SelectItem value={UNPAID}>Unpaid</SelectItem>
                  <SelectItem value={PARTIAL}>Partially paid</SelectItem>
                  <SelectItem value={PAID}>Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:ml-auto flex gap-2">
              <Button variant="outline" className="cursor-pointer" onClick={handleRechargeCsv}>
                <Download className="w-4 h-4 mr-2" /> CSV
              </Button>
              <Button
                className="cursor-pointer"
                onClick={handleRechargePdf}
                disabled={rExportingPdf}
              >
                <FileDown className="w-4 h-4 mr-2" />{" "}
                {rExportingPdf ? "Exporting..." : "PDF"}
              </Button>
            </div>
          </div>

          {recharges === undefined ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* Summary tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {rechargeSummaryTiles.map((t) => (
                  <Card key={t.label} className="min-w-0 overflow-hidden">
                    <CardContent className="pt-5 min-w-0">
                      <BarChart3 className={t.color} />
                      <p className="text-xl md:text-2xl font-bold break-words leading-tight mt-2">
                        {t.value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{t.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Recharge table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recharges ({rechargeRows.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {rechargeRows.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4 text-center">
                      No recharges match the selected filters.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="py-2 pr-4 font-medium">Username</th>
                            <th className="py-2 pr-4 font-medium">Name</th>
                            <th className="py-2 pr-4 font-medium">Package Name</th>
                            <th className="py-2 pr-4 font-medium">Date</th>
                            <th className="py-2 font-medium text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {rechargeRows.map((r, idx) => (
                            <tr key={idx} className="whitespace-nowrap">
                              <td className="py-2 pr-4 font-medium">
                                {r.customer?.username ?? "—"}
                              </td>
                              <td className="py-2 pr-4">{r.customer?.name || "—"}</td>
                              <td className="py-2 pr-4 text-muted-foreground">
                                {r.package?.name ?? "—"}
                              </td>
                              <td className="py-2 pr-4 text-muted-foreground">
                                {formatStamp(r.date)}
                              </td>
                              <td className="py-2 text-right font-semibold">
                                {formatAmount(r.amount, settings)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t">
                            <td className="py-2 pr-4 font-semibold" colSpan={4}>
                              Total ({rechargeRows.length} recharges)
                            </td>
                            <td className="py-2 text-right font-bold">
                              {formatAmount(rechargeTotal, settings)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}