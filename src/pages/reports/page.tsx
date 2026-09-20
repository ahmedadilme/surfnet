import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BarChart3, Download, FileDown, ChevronDown } from "lucide-react";
import { formatDate, todayISO, downloadCSV } from "@/lib/utils.ts";
import { useSettings, formatAmount } from "@/hooks/use-settings.ts";
import { downloadPDF } from "@/lib/export-pdf.ts";

const round = (n: number) => Math.round(n * 100) / 100;

function inRange(date: string, from: string, to: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Revenue and collections overview</p>
      </div>

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
    </div>
  );
}