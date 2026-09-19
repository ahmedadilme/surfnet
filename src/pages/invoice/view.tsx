import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Download, Share2, Wifi, Plus, Trash2, CheckCircle } from "lucide-react";
import { formatDate, todayISO } from "@/lib/utils.ts";
import { useSettings, formatAmount } from "@/hooks/use-settings.ts";
import { toPng } from "html-to-image";

export default function InvoiceViewPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const docRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const settings = useSettings();

  const recordPayment = useMutation({
    mutationFn: ({ amount, date, note }: { amount: number; date: string; note?: string }) =>
      api.post(`/invoices/${invoiceId!}/payments`, { amount, date, note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices", invoiceId] }),
  });
  const removePayment = useMutation({
    mutationFn: (id: string) => api.delete("/payments/" + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices", invoiceId] }),
  });

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [payNote, setPayNote] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [deletePayId, setDeletePayId] = useState<string | null>(null);
  const [deletePaySaving, setDeletePaySaving] = useState(false);

  const { data: invoice } = useQuery({
    queryKey: ["invoices", invoiceId],
    queryFn: () => api.get("/invoices/" + invoiceId!),
    enabled: !!invoiceId,
  });

  const handleExport = async () => {
    if (!docRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(docRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `${invoice?.number ?? "invoice"}-${invoice?.customer?.username ?? "customer"}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Invoice exported as image!");
    } catch {
      toast.error("Failed to export image");
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (!docRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(docRef.current, { quality: 1, pixelRatio: 2, backgroundColor: "#ffffff" });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${invoice?.number ?? "invoice"}-${invoice?.customer?.username ?? "customer"}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${invoice?.number} for ${invoice?.customer?.name}` });
      } else {
        const link = document.createElement("a");
        link.download = file.name;
        link.href = dataUrl;
        link.click();
        toast.info("Sharing not supported on this device — image downloaded instead.");
      }
    } catch {
      toast.error("Failed to share");
    } finally {
      setExporting(false);
    }
  };

  if (invoice === undefined) {
    return (
      <div className="max-w-xl mx-auto space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (invoice === null) {
    return <div className="text-center py-12 text-muted-foreground">Invoice not found.</div>;
  }

  const { customer } = invoice;
  const total = invoice.total ?? 0;
  const paidAmount = invoice.amountPaid ?? 0;
  const remaining = invoice.remaining ?? Math.max(total - paidAmount, 0);

  const openPayDialog = () => {
    setPayAmount(String(remaining || 0));
    setPayDate(todayISO());
    setPayNote("");
    setPayOpen(true);
  };

  const handleRecordPayment = async () => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setPaySaving(true);
    try {
      await recordPayment.mutateAsync({ amount, date: payDate, note: payNote || undefined });
      toast.success("Payment recorded");
      setPayOpen(false);
      setPayNote("");
    } catch (e) {
      toast.error((e as { error?: string })?.error ?? "Failed to record payment");
    } finally {
      setPaySaving(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!deletePayId) return;
    setDeletePaySaving(true);
    try {
      await removePayment.mutateAsync(deletePayId);
      toast.success("Payment removed");
      setDeletePayId(null);
    } catch {
      toast.error("Failed to remove payment");
    } finally {
      setDeletePaySaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold">Invoice {invoice.number}</h1>
        <div className="ml-auto flex gap-1 sm:gap-2">
          <Button variant="secondary" size="sm" className="cursor-pointer" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">{exporting ? "Exporting..." : "Export PNG"}</span>
          </Button>
          <Button size="sm" className="cursor-pointer" onClick={handleShare} disabled={exporting}>
            <Share2 className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </div>

      <div style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
        <div
          ref={docRef}
          style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", background: "#ffffff", padding: "24px", borderRadius: "28px", maxWidth: "420px", width: "420px", margin: "0" }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="" style={{ width: "40px", height: "40px", borderRadius: "10px", objectFit: "contain" }} />
              ) : (
                <div style={{ width: "40px", height: "40px", background: "#1d2340", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Wifi style={{ width: "20px", height: "20px", color: "#fff" }} />
                </div>
              )}
              <div>
                <p style={{ fontWeight: 700, fontSize: "18px", color: "#1a1a2e", margin: 0 }}>{settings.ispName}</p>
                <p style={{ fontSize: "12px", color: "#6b7280", margin: "2px 0 0" }}>Invoice</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "11px", color: "#6b7280", margin: 0 }}>Invoice #</p>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a2e", margin: "4px 0 0", wordBreak: "break-word" }}>{invoice.number}</p>
            </div>
          </div>

          {/* Date */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
            <div>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>Date</p>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", margin: "4px 0 0" }}>{formatDate(invoice.date)}</p>
            </div>
            <span style={{
              display: "inline-block",
              padding: "8px 18px",
              borderRadius: "999px",
              fontSize: "13px",
              fontWeight: 700,
              background: invoice.paid ? "#dcfce7" : paidAmount > 0 ? "#e0e7ff" : "#fef3c7",
              color: invoice.paid ? "#16a34a" : paidAmount > 0 ? "#4338ca" : "#d97706",
            }}>
              {invoice.paid ? "Paid" : paidAmount > 0 ? "Partially paid" : "Unpaid"}
            </span>
          </div>

          {/* Paid summary */}
          {paidAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "20px" }}>
              <div style={{ background: "#f0fdf4", borderRadius: "16px", padding: "14px", flex: 1 }}>
                <p style={{ margin: 0, fontSize: "11px", color: "#16a34a", fontWeight: 700 }}>PAID</p>
                <p style={{ margin: "4px 0 0", fontSize: "16px", fontWeight: 800, color: "#16a34a" }}>{formatAmount(paidAmount, settings)}</p>
              </div>
              <div style={{ background: "#fff7ed", borderRadius: "16px", padding: "14px", flex: 1 }}>
                <p style={{ margin: 0, fontSize: "11px", color: "#d97706", fontWeight: 700 }}>REMAINING</p>
                <p style={{ margin: "4px 0 0", fontSize: "16px", fontWeight: 800, color: "#d97706" }}>{formatAmount(remaining, settings)}</p>
              </div>
            </div>
          )}

          {/* Customer Info */}
          <div style={{ background: "#f5f7ff", borderRadius: "24px", padding: "24px", marginBottom: "24px" }}>
            <p style={{ fontSize: "28px", fontWeight: 800, color: "#1a1a2e", margin: "0 0 6px 0" }}>{customer?.username ?? "—"}</p>
            <p style={{ fontSize: "15px", color: "#374151", margin: "0 0 4px 0" }}>{customer?.name ?? "—"}</p>
            {customer?.phone && <p style={{ fontSize: "14px", color: "#6b7280", margin: "0 0 2px 0" }}>{customer.phone}</p>}
            {customer?.address && <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>{customer.address}</p>}
          </div>

          {/* Items */}
          <div>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a2e", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Items
            </p>
            {invoice.items.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", textAlign: "center", color: "#9ca3af", border: "1px solid #e5e7eb" }}>
                No items
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {invoice.items.map((item) => (
                  <div
                    key={item._id}
                    style={{
                      background: "#f9fafb",
                      borderRadius: "18px",
                      padding: "16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "15px", color: "#1a1a2e", wordBreak: "break-word" }}>
                        {item.description}
                      </p>
                      <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#6b7280" }}>
                        {item.quantity} × {formatAmount(item.unitPrice, settings)}
                      </p>
                    </div>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: "17px", color: "#1a1a2e", whiteSpace: "nowrap" }}>
                      {formatAmount(item.amount, settings)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            <div style={{ background: "#1d2340", borderRadius: "22px", padding: "22px", marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, opacity: 0.9 }}>Total</p>
              <p style={{ margin: 0, fontSize: "26px", fontWeight: 800 }}>{formatAmount(invoice.total, settings)}</p>
            </div>
          </div>

          {/* Note */}
          {invoice.note ? (
            <div style={{ marginTop: "20px", background: "#fff8e6", borderRadius: "18px", padding: "16px" }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#d97706", marginBottom: "4px" }}>Note</p>
              <p style={{ margin: 0, fontSize: "14px", color: "#374151", wordBreak: "break-word" }}>{invoice.note}</p>
            </div>
          ) : null}

          {/* BML Info */}
          <div style={{ marginTop: "20px", background: "linear-gradient(135deg,#ff7f7f,#ff6b6b)", borderRadius: "24px", padding: "24px", color: "#fff" }}>
            <p style={{ margin: 0, opacity: 0.9 }}>BML Account Name</p>
            <p style={{ margin: "4px 0 14px", fontSize: "20px", fontWeight: 700 }}>
              OCEAN TUNE PVT LTD
            </p>
            <p style={{ margin: 0, opacity: 0.9 }}>BML Account Number</p>
            <p style={{ margin: "4px 0 0", fontSize: "20px", fontWeight: 700, letterSpacing: "1px" }}>
              7730000530548
            </p>
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", color: "#9ca3af", fontSize: "13px", marginTop: "24px" }}>
            Thank you for your business · {settings.ispName}
          </div>
        </div>
      </div>

      {/* Payment History (excluded from PNG export) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Payment History
              {invoice.payments?.length ? ` (${invoice.payments.length})` : ""}
            </CardTitle>
            {remaining > 0 && (
              <Button size="sm" className="cursor-pointer" onClick={openPayDialog}>
                <Plus className="w-3 h-3 mr-1" /> Record Payment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!invoice.payments?.length ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              {remaining > 0
                ? "No payments recorded yet. Remaining: " + formatAmount(remaining, settings)
                : "No payments recorded."}
            </p>
          ) : (
            <div className="divide-y">
              {invoice.payments.map((pmt) => (
                <div key={pmt._id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{formatAmount(pmt.amount, settings)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(pmt.date)}
                      {pmt.note ? ` · ${pmt.note}` : ""}
                      {pmt.user?.name ? ` · by ${pmt.user.name}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer text-destructive hover:text-destructive"
                    onClick={() => setDeletePayId(pmt._id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" min="0" placeholder="0.00" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Remaining balance: {formatAmount(remaining, settings)}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. Cash received, bank transfer..." value={payNote} onChange={(e) => setPayNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={paySaving} className="cursor-pointer">
              {paySaving ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Confirmation */}
      <Dialog open={!!deletePayId} onOpenChange={(v) => !v && setDeletePayId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Payment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove this payment? The invoice balance will be recalculated.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletePayId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeletePayment}
              disabled={deletePaySaving}
              className="cursor-pointer"
            >
              {deletePaySaving ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}