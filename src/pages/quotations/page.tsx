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
import { Search, FileText, Pencil, Trash2, Download, Plus, X } from "lucide-react";
import { formatDate, todayISO, downloadCSV } from "@/lib/utils.ts";
import { useSettings, formatAmount } from "@/hooks/use-settings.ts";
import { useNavigate } from "react-router-dom";

type LineItem = { description: string; quantity: string; unitPrice: string };

const EMPTY_ITEM: LineItem = { description: "", quantity: "1", unitPrice: "" };

type QuoteForm = {
  customerId: string;
  number: string;
  date: string;
  validUntil: string;
  note: string;
  items: LineItem[];
};

const STATUS_COLORS: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "#fef3c7", color: "#d97706" },
  accepted: { label: "Accepted", bg: "#dcfce7", color: "#16a34a" },
  declined: { label: "Declined", bg: "#fee2e2", color: "#dc2626" },
};

function itemTotal(it: LineItem): number {
  const qty = parseInt(it.quantity, 10) || 0;
  const price = parseFloat(it.unitPrice) || 0;
  return Math.round(qty * price * 100) / 100;
}

export default function QuotationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const settings = useSettings();

  const { data: quotations } = useQuery({
    queryKey: ["quotations"],
    queryFn: () => api.get("/quotations"),
  });
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers"),
  });

  const createQuote = useMutation({
    mutationFn: (data: { customerId: string; date: string; validUntil?: string; note?: string; items: { description: string; quantity: number; unitPrice: number }[] }) =>
      api.post("/quotations", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotations"] }),
  });
  const updateQuote = useMutation({
    mutationFn: (data: { id: string; customerId: string; date: string; validUntil?: string; note?: string; items: { description: string; quantity: number; unitPrice: number }[] }) =>
      api.put("/quotations/" + data.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotations"] }),
  });
  const removeQuote = useMutation({
    mutationFn: (id: string) => api.delete("/quotations/" + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotations"] }),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.post("/quotations/" + id + "/status", { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotations"] }),
  });

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<QuoteForm>({ customerId: "", number: "", date: todayISO(), validUntil: "", note: "", items: [{ ...EMPTY_ITEM }] });
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openAdd = () => {
    setForm({ customerId: "", number: "", date: todayISO(), validUntil: "", note: "", items: [{ ...EMPTY_ITEM }] });
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (q: NonNullable<typeof quotations>[number]) => {
    setForm({
      customerId: q.customerId,
      number: q.number,
      date: q.date,
      validUntil: q.validUntil ?? "",
      note: q.note ?? "",
      items: q.items.length
        ? q.items.map((i) => ({ description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice) }))
        : [{ ...EMPTY_ITEM }],
    });
    setEditId(q._id);
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
        await updateQuote.mutateAsync({ id: editId, customerId: form.customerId, date: form.date, validUntil: form.validUntil || undefined, note: form.note || undefined, items });
        toast.success("Quotation updated");
      } else {
        await createQuote.mutateAsync({ customerId: form.customerId, date: form.date, validUntil: form.validUntil || undefined, note: form.note || undefined, items });
        toast.success("Quotation created");
      }
      setOpen(false);
    } catch {
      toast.error("Failed to save quotation");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeQuote.mutateAsync(id);
      toast.success("Quotation deleted");
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await setStatus.mutateAsync({ id, status });
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const q = searchQuery.toLowerCase();
  const filtered = (quotations ?? []).filter((quote) => {
    if (dateFrom && quote.date < dateFrom) return false;
    if (dateTo && quote.date > dateTo) return false;
    if (q && !quote.customer?.username?.toLowerCase().includes(q) && !quote.number.toLowerCase().includes(q) && !(quote.note ?? "").toLowerCase().includes(q)) return false;
    return true;
  });

  const statusBadge = (quote: NonNullable<typeof quotations>[number]) => {
    const s = STATUS_COLORS[quote.status] ?? { label: quote.status, bg: "#f3f4f6", color: "#6b7280" };
    return (
      <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: s.bg, color: s.color }}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quotations</h1>
          <p className="text-muted-foreground text-sm mt-1">Quotes for additional services</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() =>
              downloadCSV(
                (quotations ?? []).map((quote) => ({
                  No: quote.number,
                  Customer: quote.customer?.username ?? "",
                  Total: quote.total,
                  Date: quote.date,
                  ValidUntil: quote.validUntil ?? "",
                  Status: quote.status,
                  Note: quote.note ?? "",
                })),
                `quotations-${todayISO()}.csv`
              )
            }
          >
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button onClick={openAdd} className="cursor-pointer">
            <Plus className="w-4 h-4 mr-2" /> New Quotation
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
        <p className="text-xs text-muted-foreground sm:ml-auto">{quotations?.length ?? 0} quotations</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {quotations === undefined ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">No quotations yet.</p>
          ) : (
            <div className="divide-y">
              {filtered.map((quote) => (
                <div key={quote._id} className="flex items-center justify-between py-3 px-4">
                  <div>
                    <p className="font-semibold text-sm">{quote.customer?.username ?? "?"}</p>
                    <p className="text-xs text-muted-foreground">
                      {quote.number} · {formatDate(quote.date)}
                      {quote.validUntil ? ` · Valid till ${formatDate(quote.validUntil)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-end">
                    <span className="font-bold">{formatAmount(quote.total, settings)}</span>
                    {statusBadge(quote)}
                    <Select value={quote.status} onValueChange={(v) => handleStatus(quote._id, v)}>
                      <SelectTrigger size="sm" className="w-28 h-8 cursor-pointer">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending" className="cursor-pointer">Pending</SelectItem>
                        <SelectItem value="accepted" className="cursor-pointer">Accepted</SelectItem>
                        <SelectItem value="declined" className="cursor-pointer">Declined</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openEdit(quote)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="cursor-pointer text-destructive hover:text-destructive" onClick={() => setDeleteId(quote._id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => navigate(`/quotation/${quote._id}`)}>
                      <FileText className="w-3 h-3 sm:mr-1" />
                      <span className="hidden sm:inline">View</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Quotation Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? `Edit ${form.number || "Quotation"}` : "New Quotation"}</DialogTitle>
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
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Valid Until</Label>
                <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
              </div>
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

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Quotation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this quotation? This action cannot be undone.
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