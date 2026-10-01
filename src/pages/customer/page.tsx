import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertCircle,
  CalendarDays,
  CheckCircle,
  CreditCard,
  DollarSign,
  FileText,
  Receipt,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { formatDate, todayISO } from "@/lib/utils.ts";
import { useSettings, formatAmount } from "@/hooks/use-settings.ts";

type Customer = {
  _id: string;
  username: string;
  name: string;
  phone?: string | null;
  address?: string | null;
};

type Recharge = {
  _id: string;
  amount: number;
  amountPaid?: number | null;
  date: string;
  note?: string | null;
  paid?: boolean;
  remaining?: number;
  package?: { name: string } | null;
};

type Payment = {
  _id: string;
  amount: number;
  date: string;
  note?: string | null;
  type: "Invoice" | "Recharge";
  reference?: string | null;
  user?: { name: string } | null;
};

type Invoice = {
  _id: string;
  number: string;
  date: string;
  note?: string | null;
  total: number;
  paidAmount: number;
  remaining: number;
  paid: boolean;
  items?: { _id: string; description: string; quantity: number; unitPrice: number; amount: number }[];
};

const OVERDUE_DAYS = 30;
const ALL = "all";
const UNPAID = "unpaid";
const PARTIAL = "partial";
const PAID = "paid";
const OVERDUE = "overdue";

const isOverdue = (date: string) =>
  (Date.now() - new Date(date).getTime()) / 86400000 > OVERDUE_DAYS;

const isPartial = (amountPaid: number | null | undefined) => (amountPaid ?? 0) > 0;

const round = (n: number) => Math.round(n * 100) / 100;

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="pt-5 min-w-0">
        <div className={`mb-2 ${color}`}>{icon}</div>
        <p className="text-xl md:text-2xl font-bold break-words leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{title}</p>
      </CardContent>
    </Card>
  );
}

function FilterBar({
  search,
  onSearch,
  placeholder,
  dateFrom,
  onDateFrom,
  dateTo,
  onDateTo,
  count,
  children,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder: string;
  dateFrom: string;
  onDateFrom: (v: string) => void;
  dateTo: string;
  onDateTo: (v: string) => void;
  count: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <Input type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} className="w-28 sm:w-36" placeholder="From" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} className="w-28 sm:w-36" placeholder="To" />
      </div>
      {children}
      <p className="text-xs text-muted-foreground sm:ml-auto">{count} entries</p>
    </div>
  );
}

function PaidPill() {
  return (
    <span className="text-green-600 text-xs font-medium bg-green-50 px-2 py-0.5 rounded-full">
      Paid
    </span>
  );
}

function OutstandingPill({ amount }: { amount: string }) {
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
      <AlertCircle className="w-3 h-3" />
      {amount}
    </span>
  );
}

export default function CustomerPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useSettings();

  const { data: customer } = useQuery({
    queryKey: ["customers", customerId],
    queryFn: () => api.get<Customer | null>("/customers/" + customerId!),
    enabled: !!customerId,
  });
  const { data: recharges } = useQuery({
    queryKey: ["recharges", "customer", customerId],
    queryFn: () => api.get<Recharge[]>("/recharges/customer/" + customerId!),
    enabled: !!customerId,
  });
  const { data: payments } = useQuery({
    queryKey: ["payments", "customer", customerId],
    queryFn: () => api.get<Payment[]>("/payments/customer/" + customerId!),
    enabled: !!customerId,
  });
  const { data: invoices } = useQuery({
    queryKey: ["invoices", "customer", customerId],
    queryFn: () => api.get<Invoice[]>("/invoices/customer/" + customerId!),
    enabled: !!customerId,
  });

  const recordRechargePayment = useMutation({
    mutationFn: ({ id, amount, date, note }: { id: string; amount: number; date: string; note?: string }) =>
      api.post("/recharges/" + id + "/payments", { amount, date, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recharges"] });
      queryClient.invalidateQueries({ queryKey: ["recharges", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["recharges", "unpaidTotals"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
  const recordInvoicePayment = useMutation({
    mutationFn: ({ id, amount, date, note }: { id: string; amount: number; date: string; note?: string }) =>
      api.post("/invoices/" + id + "/payments", { amount, date, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", "unpaidTotals"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
  const deletePayment = useMutation({
    mutationFn: (id: string) => api.delete("/payments/" + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["recharges"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const [rSearch, setRSearch] = useState("");
  const [rFrom, setRFrom] = useState("");
  const [rTo, setRTo] = useState("");
  const [rStatus, setRStatus] = useState(ALL);

  const [pSearch, setPSearch] = useState("");
  const [pFrom, setPFrom] = useState("");
  const [pTo, setPTo] = useState("");
  const [pType, setPType] = useState(ALL);

  const [iSearch, setISearch] = useState("");
  const [iFrom, setIFrom] = useState("");
  const [iTo, setITo] = useState("");
  const [iStatus, setIStatus] = useState(ALL);

  const [payTarget, setPayTarget] = useState<Recharge | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [invPayTarget, setInvPayTarget] = useState<Invoice | null>(null);
  const [invPayAmount, setInvPayAmount] = useState("");
  const [invPayDate, setInvPayDate] = useState(todayISO());
  const [invPayNote, setInvPayNote] = useState("");
  const [invSaving, setInvSaving] = useState(false);

  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  if (customer === undefined || recharges === undefined || payments === undefined || invoices === undefined) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (customer === null) {
    return <div className="text-center py-12 text-muted-foreground">Customer not found.</div>;
  }

  const totalRecharged = round(recharges.reduce((s, r) => s + r.amount, 0));
  const totalPaid = round(payments.reduce((s, p) => s + p.amount, 0));
  const rechargeOutstanding = round(recharges.reduce((s, r) => s + (r.remaining ?? r.amount), 0));
  const invoiceOutstanding = round(invoices.reduce((s, i) => s + i.remaining, 0));
  const totalInvoiced = round(invoices.reduce((s, i) => s + i.total, 0));
  const overdueCount =
    recharges.filter((r) => (r.remaining ?? r.amount) > 0 && isOverdue(r.date)).length +
    invoices.filter((i) => i.remaining > 0 && isOverdue(i.date)).length;
  const lastPayment = payments[0];

  const rq = rSearch.toLowerCase();
  const filteredRecharges = recharges.filter((r) => {
    if (rFrom && r.date < rFrom) return false;
    if (rTo && r.date > rTo) return false;
    if (
      rq &&
      !r.package?.name?.toLowerCase().includes(rq) &&
      !(r.note ?? "").toLowerCase().includes(rq) &&
      !(r.date ?? "").toLowerCase().includes(rq)
    )
      return false;
    const remaining = r.remaining ?? r.amount;
    if (rStatus === UNPAID && remaining <= 0) return false;
    if (rStatus === PAID && remaining > 0) return false;
    if (rStatus === PARTIAL && !(isPartial(r.amountPaid) && remaining > 0)) return false;
    if (rStatus === OVERDUE && !(remaining > 0 && isOverdue(r.date))) return false;
    return true;
  });

  const pq = pSearch.toLowerCase();
  const filteredPayments = payments.filter((p) => {
    if (pFrom && p.date < pFrom) return false;
    if (pTo && p.date > pTo) return false;
    if (
      pq &&
      !(p.note ?? "").toLowerCase().includes(pq) &&
      !(p.reference ?? "").toLowerCase().includes(pq) &&
      !(p.type ?? "").toLowerCase().includes(pq)
    )
      return false;
    if (pType !== ALL && p.type !== pType) return false;
    return true;
  });

  const iq = iSearch.toLowerCase();
  const filteredInvoices = invoices.filter((inv) => {
    if (iFrom && inv.date < iFrom) return false;
    if (iTo && inv.date > iTo) return false;
    if (
      iq &&
      !inv.number?.toLowerCase().includes(iq) &&
      !(inv.note ?? "").toLowerCase().includes(iq) &&
      !(inv.date ?? "").toLowerCase().includes(iq)
    )
      return false;
    if (iStatus === UNPAID && inv.remaining <= 0) return false;
    if (iStatus === PAID && inv.remaining > 0) return false;
    if (iStatus === PARTIAL && !(isPartial(inv.paidAmount) && inv.remaining > 0)) return false;
    if (iStatus === OVERDUE && !(inv.remaining > 0 && isOverdue(inv.date))) return false;
    return true;
  });

  const openPayDialog = (r: Recharge) => {
    setPayTarget(r);
    setPayAmount(String(round(r.remaining ?? r.amount)));
    setPayDate(todayISO());
    setPayNote("");
  };

  const handleRecordPayment = async () => {
    if (!payTarget) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await recordRechargePayment.mutateAsync({
        id: payTarget._id,
        amount,
        date: payDate,
        note: payNote || undefined,
      });
      toast.success("Payment recorded!");
      setPayTarget(null);
      setPayNote("");
    } catch (e) {
      toast.error((e as { error?: string })?.error ?? "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const openInvoicePayDialog = (inv: Invoice) => {
    setInvPayTarget(inv);
    setInvPayAmount(String(round(inv.remaining)));
    setInvPayDate(todayISO());
    setInvPayNote("");
  };

  const handleRecordInvoicePayment = async () => {
    if (!invPayTarget) return;
    const amount = parseFloat(invPayAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setInvSaving(true);
    try {
      await recordInvoicePayment.mutateAsync({
        id: invPayTarget._id,
        amount,
        date: invPayDate,
        note: invPayNote || undefined,
      });
      toast.success("Payment recorded!");
      setInvPayTarget(null);
      setInvPayNote("");
    } catch (e) {
      toast.error((e as { error?: string })?.error ?? "Failed to record payment");
    } finally {
      setInvSaving(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentId) return;
    setDeleteSaving(true);
    try {
      await deletePayment.mutateAsync(deletePaymentId);
      toast.success("Payment deleted!");
      setDeletePaymentId(null);
    } catch (e) {
      toast.error((e as { error?: string })?.error ?? "Failed to delete payment");
    } finally {
      setDeleteSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="cursor-pointer"
          onClick={() => navigate("/customers")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{customer.name || customer.username}</h1>
          <p className="text-xs text-muted-foreground truncate">
            {customer.username}
            {customer.phone ? ` · ${customer.phone}` : ""}
            {customer.address ? ` · ${customer.address}` : ""}
          </p>
        </div>
        <div className="ml-auto flex gap-1 sm:gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="cursor-pointer"
            onClick={() => navigate("/statement/" + customerId)}
          >
            <FileText className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Statement</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Recharged"
          value={formatAmount(totalRecharged, settings)}
          icon={<DollarSign className="w-5 h-5" />}
          color="text-primary"
        />
        <StatCard
          title="Total Paid"
          value={formatAmount(totalPaid, settings)}
          icon={<CheckCircle className="w-5 h-5" />}
          color="text-green-600"
        />
        <StatCard
          title="Outstanding (Recharge)"
          value={formatAmount(rechargeOutstanding, settings)}
          icon={<AlertCircle className="w-5 h-5" />}
          color="text-amber-500"
        />
        <StatCard
          title="Invoice Outstanding"
          value={formatAmount(invoiceOutstanding, settings)}
          icon={<Receipt className="w-5 h-5" />}
          color="text-amber-500"
        />
        <StatCard
          title="Total Invoiced"
          value={formatAmount(totalInvoiced, settings)}
          icon={<FileText className="w-5 h-5" />}
          color="text-primary"
        />
        <StatCard
          title="Overdue Records"
          value={String(overdueCount)}
          icon={<CalendarDays className="w-5 h-5" />}
          color={overdueCount > 0 ? "text-destructive" : "text-muted-foreground"}
        />
        <StatCard
          title="Last Payment"
          value={lastPayment ? formatDate(lastPayment.date) : "No payments yet"}
          icon={<CreditCard className="w-5 h-5" />}
          color="text-muted-foreground"
        />
      </div>

      <Tabs defaultValue="recharges">
        <TabsList>
          <TabsTrigger value="recharges">
            <Zap className="w-3.5 h-3.5" />
            Recharges ({recharges.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="w-3.5 h-3.5" />
            Payments ({payments.length})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <FileText className="w-3.5 h-3.5" />
            Invoices ({invoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recharges" className="space-y-4">
          <FilterBar
            search={rSearch}
            onSearch={setRSearch}
            placeholder="Search by package, note..."
            dateFrom={rFrom}
            onDateFrom={setRFrom}
            dateTo={rTo}
            onDateTo={setRTo}
            count={filteredRecharges.length}
          >
            <Select value={rStatus} onValueChange={setRStatus}>
              <SelectTrigger className="w-full sm:w-44 h-9 cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value={UNPAID}>Unpaid</SelectItem>
                <SelectItem value={PARTIAL}>Partially paid</SelectItem>
                <SelectItem value={PAID}>Paid</SelectItem>
                <SelectItem value={OVERDUE}>Overdue</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recharges ({filteredRecharges.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRecharges.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No recharges found.</p>
              ) : (
                <div className="divide-y">
                  {filteredRecharges.map((r) => {
                    const remaining = r.remaining ?? r.amount;
                    const partial = isPartial(r.amountPaid) && remaining > 0;
                    const overdue = remaining > 0 && isOverdue(r.date);
                    return (
                      <div key={r._id} className="flex items-center justify-between py-3 px-4 gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{r.package?.name ?? "Recharge"}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(r.date)}
                            {r.note ? ` · ${r.note}` : ""}
                            {overdue && <span className="ml-2 text-amber-600 font-medium">Overdue</span>}
                          </p>
                          {partial && (
                            <p className="text-xs text-amber-600 font-medium">
                              {formatAmount(r.amountPaid ?? 0, settings)} paid of{" "}
                              {formatAmount(r.amount, settings)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-end shrink-0">
                          {remaining > 0 ? (
                            <OutstandingPill amount={formatAmount(remaining, settings)} />
                          ) : (
                            <PaidPill />
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => navigate(`/receipt/${r._id}`)}
                          >
                            <FileText className="w-3 h-3 sm:mr-1" />
                            <span className="hidden sm:inline">Receipt</span>
                          </Button>
                          {remaining > 0 && (
                            <Button
                              size="sm"
                              className="cursor-pointer"
                              onClick={() => openPayDialog(r)}
                            >
                              <CheckCircle className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">Record Payment</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <FilterBar
            search={pSearch}
            onSearch={setPSearch}
            placeholder="Search by note, reference..."
            dateFrom={pFrom}
            onDateFrom={setPFrom}
            dateTo={pTo}
            onDateTo={setPTo}
            count={filteredPayments.length}
          >
            <Select value={pType} onValueChange={setPType}>
              <SelectTrigger className="w-full sm:w-44 h-9 cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                <SelectItem value="Recharge">Recharge</SelectItem>
                <SelectItem value="Invoice">Invoice</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments ({filteredPayments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredPayments.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No payments recorded yet.
                </p>
              ) : (
                <div className="divide-y">
                  {filteredPayments.map((p) => (
                    <div key={p._id} className="flex items-center justify-between py-3 px-4 gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{formatAmount(p.amount, settings)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(p.date)}
                          {p.note ? ` · ${p.note}` : ""}
                          {p.user?.name ? ` · by ${p.user.name}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-end shrink-0">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            p.type === "Invoice"
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {p.type}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="cursor-pointer text-destructive hover:text-destructive"
                          onClick={() => setDeletePaymentId(p._id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <FilterBar
            search={iSearch}
            onSearch={setISearch}
            placeholder="Search by number, note..."
            dateFrom={iFrom}
            onDateFrom={setIFrom}
            dateTo={iTo}
            onDateTo={setITo}
            count={filteredInvoices.length}
          >
            <Select value={iStatus} onValueChange={setIStatus}>
              <SelectTrigger className="w-full sm:w-44 h-9 cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value={UNPAID}>Unpaid</SelectItem>
                <SelectItem value={PARTIAL}>Partially paid</SelectItem>
                <SelectItem value={PAID}>Paid</SelectItem>
                <SelectItem value={OVERDUE}>Overdue</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoices ({filteredInvoices.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredInvoices.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No invoices found.</p>
              ) : (
                <div className="divide-y">
                  {filteredInvoices.map((inv) => {
                    const partial = isPartial(inv.paidAmount) && inv.remaining > 0;
                    const overdue = inv.remaining > 0 && isOverdue(inv.date);
                    return (
                      <div key={inv._id} className="flex items-center justify-between py-3 px-4 gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{inv.number}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(inv.date)} · {inv.items?.length ?? 0} item
                            {(inv.items?.length ?? 0) === 1 ? "" : "s"} ·{" "}
                            {formatAmount(inv.total, settings)}
                            {inv.note ? ` · ${inv.note}` : ""}
                            {overdue && (
                              <span className="ml-2 text-amber-600 font-medium">Overdue</span>
                            )}
                          </p>
                          {partial && (
                            <p className="text-xs text-amber-600 font-medium">
                              {formatAmount(inv.paidAmount, settings)} paid of{" "}
                              {formatAmount(inv.total, settings)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-end shrink-0">
                          {inv.remaining > 0 ? (
                            <OutstandingPill amount={formatAmount(inv.remaining, settings)} />
                          ) : (
                            <PaidPill />
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => navigate(`/invoice/${inv._id}`)}
                          >
                            <FileText className="w-3 h-3 sm:mr-1" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                          {inv.remaining > 0 && (
                            <Button
                              size="sm"
                              className="cursor-pointer"
                              onClick={() => openInvoicePayDialog(inv)}
                            >
                              <CheckCircle className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">Record Payment</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!payTarget} onOpenChange={(v) => !v && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
              {payTarget && (
                <p className="text-xs text-muted-foreground mt-1">
                  Remaining balance:{" "}
                  {formatAmount(payTarget.remaining ?? payTarget.amount, settings)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input
                placeholder="e.g. Cash received, bank transfer..."
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={saving} className="cursor-pointer">
              {saving ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!invPayTarget} onOpenChange={(v) => !v && setInvPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                placeholder="0.00"
                value={invPayAmount}
                onChange={(e) => setInvPayAmount(e.target.value)}
              />
              {invPayTarget && (
                <p className="text-xs text-muted-foreground mt-1">
                  Remaining balance: {formatAmount(invPayTarget.remaining, settings)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={invPayDate}
                onChange={(e) => setInvPayDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input
                placeholder="e.g. Cash received, bank transfer..."
                value={invPayNote}
                onChange={(e) => setInvPayNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInvPayTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordInvoicePayment}
              disabled={invSaving}
              className="cursor-pointer"
            >
              {invSaving ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletePaymentId} onOpenChange={(v) => !v && setDeletePaymentId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this payment? The related recharge or invoice balance
            will be adjusted back.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletePaymentId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePayment}
              disabled={deleteSaving}
              className="cursor-pointer"
            >
              {deleteSaving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
