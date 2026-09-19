import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { Search, CheckCircle, FileText, Pencil, Trash2, Download, Plus, X } from "lucide-react";
import { formatDate, todayISO, downloadCSV } from "@/lib/utils.ts";
import { useSettings, formatAmount } from "@/hooks/use-settings.ts";
import { useNavigate } from "react-router-dom";

type LineItem = { description: string; quantity: string; unitPrice: string };

const EMPTY_ITEM: LineItem = { description: "", quantity: "1", unitPrice: "" };

type InvoiceForm = {
  customerId: string;
  number: string;
  date: string;
  note: string;
  items: LineItem[];
};

function itemTotal(it: LineItem): number {
  const qty = parseInt(it.quantity, 10) || 0;
  const price = parseFloat(it.unitPrice) || 0;
  return Math.round(qty * price * 100) / 100;
}

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const settings = useSettings();

  const { data: invoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api.get("/invoices"),
  });
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers"),
  });

  const createInvoice = useMutation({
    mutationFn: (data: { customerId: string; date: string; note?: string; items: { description: string; quantity: number; unitPrice: number }[] }) =>
      api.post("/invoices", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });
  const updateInvoice = useMutation({
    mutationFn: (data: { id: string; customerId: string; date: string; note?: string; items: { description: string; quantity: number; unitPrice: number }[] }) =>
      api.put("/invoices/" + data.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });
  const removeInvoice = useMutation({
    mutationFn: (id: string) => api.delete("/invoices/" + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });
  const markPaid = useMutation({
    mutationFn: ({ id, paymentDate, paymentNote }: { id: string; paymentDate: string; paymentNote?: string }) =>
      api.post("/invoices/" + id + "/mark-paid", { paymentDate, paymentNote }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceForm>({ customerId: "", number: "", date: todayISO(), note: "", items: [{ ...EMPTY_ITEM }] });
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(todayISO());
  const [payNote, setPayNote] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAdd = () => {
    setForm({ customerId: "", number: "", date: todayISO(), note: "", items: [{ ...EMPTY_ITEM }] });
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (inv: NonNullable<typeof invoices>[number]) => {
    setForm({
      customerId: inv.customerId,
      number: inv.number,
      date: inv.date,
      note: inv.note ?? "",
      items: inv.items.length
        ? inv.items.map((i) => ({ description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice) }))
        : [{ ...EMPTY_ITEM }],
    });
    setEditId(inv._id);
    setOpen(true);
  };

  const formTotal = form.items.reduce((s, it) => s + itemTotal(it), 0);

  const handleSave = async () => {
    if (!form.customerId) { toast.error("Select a customer"); return; }
    const items = form.items
      .map((it) => ({ description: it.description.trim(), quantity: parseInt(it.quantity, 10) || 1, unitPrice: parseFloat(it.unitPrice) || 0 }))
      .filter((it) => it.description !== "");
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    setSaving(true);
    try {
      if (editId) {
        await updateInvoice.mutateAsync({ id: editId, customerId: form.customerId, date: form.date, note: form.note || undefined, items });
        toast.success("Invoice updated");
      } else {
        await createInvoice.mutateAsync({ customerId: form.customerId, date: form.date, note: form.note || undefined, items });
        toast.success("Invoice created");
      }
      setOpen(false);
    } catch {
      toast.error("Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!payingId) return;
    setPaySaving(true);
    try {
      await markPaid.mutateAsync({ id: payingId, paymentDate: payDate, paymentNote: payNote || undefined });
      toast.success("Invoice marked as paid");
      setPayingId(null);
      setPayNote("");
    } catch {
      toast.error("Failed to mark as paid");
    } finally {
      setPaySaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeInvoice.mutateAsync(id);
      toast.success("Invoice deleted");
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete");
    }
  };

  const q = searchQuery.toLowerCase();
  const filtered = (invoices ?? []).filter((inv) => {
    if (dateFrom && inv.date < dateFrom) return false;
    if (dateTo && inv.date > dateTo) return false;
    if (q && !inv.customer?.username?.toLowerCase().includes(q) && !inv.number.toLowerCase().includes(q) && !(inv.note ?? "").toLowerCase().includes(q)) return false;
    return true;
  });
  const unpaid = filtered.filter((inv) => !inv.paid);
  const paid = filtered.filter((inv) => inv.paid);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground text-sm mt-1">Bill customers for additional services</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() =>
              downloadCSV(
                (invoices ?? []).map((inv) => ({
                  No: inv.number,
                  Customer: inv.customer?.username ?? "",
                  Total: inv.total,
                  Date: inv.date,
                  Status: inv.paid ? "Paid" : "Unpaid",
                  Note: inv.note ?? "",
                })),
                `invoices-${todayISO()}.csv`
              )
            }
          >
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button onClick={openAdd} className="cursor-pointer">
            <Plus className="w-4 h-4 mr-2" /> New Invoice
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by customer, number, note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-28 sm:w-36" placeholder="From" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-28 sm:w-36" placeholder="To" />
        </div>
        <p className="text-xs text-muted-foreground sm:ml-auto">{invoices?.length ?? 0} invoices</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-amber-500" />
            Outstanding ({unpaid.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : unpaid.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No outstanding invoices.</p>
          ) : (
            <div className="divide-y">
              {unpaid.map((inv) => (
                <div key={inv._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-sm">{inv.customer?.username ?? "?"}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.number} · {formatDate(inv.date)}
                      {inv.note ? ` · ${inv.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-end">
                    <span className="font-bold">{formatAmount(inv.total, settings)}</span>
                    <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openEdit(inv)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="cursor-pointer text-destructive hover:text-destructive" onClick={() => setDeleteId(inv._id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => navigate(`/invoice/${inv._id}`)}>
                      <FileText className="w-3 h-3 sm:mr-1" />
                      <span className="hidden sm:inline">View</span>
                    </Button>
                    <Button size="sm" className="cursor-pointer" onClick={() => { setPayingId(inv._id); setPayDate(todayISO()); setPayNote(""); }}>
                      <CheckCircle className="w-3 h-3 sm:mr-1" />
                      <span className="hidden sm:inline">Mark Paid</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Paid ({paid.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paid.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No paid invoices yet.</p>
          ) : (
            <div className="divide-y">
              {paid.map((inv) => (
                <div key={inv._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-sm">{inv.customer?.username ?? "?"}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.number} · {formatDate(inv.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-end">
                    <span className="font-bold">{formatAmount(inv.total, settings)}</span>
                    <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openEdit(inv)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="cursor-pointer text-destructive hover:text-destructive" onClick={() => setDeleteId(inv._id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => navigate(`/invoice/${inv._id}`)}>
                      <FileText className="w-3 h-3 sm:mr-1" />
                      <span className="hidden sm:inline">View</span>
                    </Button>
                    <span className="text-green-600 text-xs font-medium bg-green-50 px-2 py-0.5 rounded-full">Paid</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Invoice Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? `Edit ${form.number || "Invoice"}` : "New Invoice"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {(customers ?? []).map((c) => (
                    <SelectItem key={c._id} value={c._id} className="cursor-pointer">
                      {c.username} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Items *</Label>
              {form.items.map((it, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Input
                    placeholder="Description (e.g. Router setup)"
                    value={it.description}
                    onChange={(e) => setForm({ ...form, items: form.items.map((x, i) => i === idx ? { ...x, description: e.target.value } : x) })}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={it.quantity}
                    onChange={(e) => setForm({ ...form, items: form.items.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x) })}
                    className="w-16"
                  />
                  <Input
                    type="number"
                    placeholder="Price"
                    value={it.unitPrice}
                    onChange={(e) => setForm({ ...form, items: form.items.map((x, i) => i === idx ? { ...x, unitPrice: e.target.value } : x) })}
                    className="w-24"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="cursor-pointer shrink-0"
                    onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2">
                <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setForm({ ...form, items: [...form.items, { ...EMPTY_ITEM }] })}>
                  <Plus className="w-3 h-3 mr-1" /> Add Item
                </Button>
                <p className="text-sm font-bold">Total: {formatAmount(formTotal, settings)}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Note</Label>
              <Input placeholder="Optional note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Payment Dialog */}
      <Dialog open={!!payingId} onOpenChange={(v) => !v && setPayingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
            <Button variant="ghost" onClick={() => setPayingId(null)}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={paySaving} className="cursor-pointer">
              {paySaving ? "Saving..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this invoice? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="cursor-pointer">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}