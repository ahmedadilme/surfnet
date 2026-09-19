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
import { Search, CheckCircle, CreditCard, FileText, Pencil, Trash2, Download } from "lucide-react";
import { formatDate, todayISO, downloadCSV } from "@/lib/utils.ts";
import { useSettings, formatAmount } from "@/hooks/use-settings.ts";
import { useNavigate } from "react-router-dom";

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const { data: recharges } = useQuery({
    queryKey: ["recharges"],
    queryFn: () => api.get("/recharges"),
  });
  const { data: packages } = useQuery({
    queryKey: ["packages"],
    queryFn: () => api.get("/packages"),
  });
  const markPaid = useMutation({
    mutationFn: ({ rechargeId, paymentDate, paymentNote }: { rechargeId: string; paymentDate: string; paymentNote?: string }) =>
      api.post("/recharges/" + rechargeId + "/mark-paid", { paymentDate, paymentNote }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recharges"] }),
  });
  const markManyPaid = useMutation({
    mutationFn: (data: { rechargeIds: string[]; paymentDate: string }) =>
      api.post("/recharges/mark-many-paid", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recharges"] }),
  });
  const updateRecharge = useMutation({
    mutationFn: (data: { id: string; packageId: string; amount: number; date: string; note?: string }) =>
      api.put("/recharges/" + data.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recharges"] }),
  });
  const removeRecharge = useMutation({
    mutationFn: (id: string) => api.delete("/recharges/" + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recharges"] }),
  });
  const navigate = useNavigate();

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(todayISO());
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [editRecharge, setEditRecharge] = useState<{
    _id: string;
    packageId: string;
    amount: string;
    date: string;
    note: string;
  } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const settings = useSettings();

  const q = searchQuery.toLowerCase();
  const filterRecharges = (items: typeof recharges) =>
    items?.filter((r) => {
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (q && !r.customer?.username?.toLowerCase().includes(q) && !r.package?.name?.toLowerCase().includes(q) && !(r.note ?? "").toLowerCase().includes(q)) return false;
      return true;
    }) ?? [];

  const unpaid = filterRecharges(recharges?.filter((r) => !r.paid)) ?? [];
  const paid = filterRecharges(recharges?.filter((r) => r.paid)) ?? [];

  const handleMarkPaid = async () => {
    if (!payingId) return;
    setSaving(true);
    try {
      await markPaid.mutateAsync({ rechargeId: payingId, paymentDate: payDate, paymentNote: payNote || undefined });
      toast.success("Marked as paid!");
      setPayingId(null);
      setPayNote("");
    } catch {
      toast.error("Failed to mark as paid");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (r: NonNullable<typeof recharges>[number]) => {
    if (!r) return;
    setEditRecharge({
      _id: r._id,
      packageId: r.packageId,
      amount: String(r.amount),
      date: r.date,
      note: r.note ?? "",
    });
  };

  const handleEditSave = async () => {
    if (!editRecharge) return;
    const amount = parseFloat(editRecharge.amount);
    if (isNaN(amount) || amount <= 0) { toast.error("Invalid amount"); return; }
    setEditSaving(true);
    try {
      await updateRecharge.mutateAsync({
        id: editRecharge._id,
        packageId: editRecharge.packageId,
        amount,
        date: editRecharge.date,
        note: editRecharge.note || undefined,
      });
      toast.success("Recharge updated");
      setEditRecharge(null);
    } catch {
      toast.error("Failed to update");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeRecharge.mutateAsync(id);
      toast.success("Recharge deleted");
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete");
    }
  };

  const selectedPkg = packages?.find((p) => p._id === editRecharge?.packageId);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === unpaid.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unpaid.map((r) => r._id)));
    }
  };

  const handleBulkMarkPaid = async () => {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      await markManyPaid.mutateAsync({ rechargeIds: Array.from(selectedIds), paymentDate: todayISO() });
      toast.success(`${selectedIds.size} payments marked as paid!`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to mark payments");
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manually verify and mark payments
          </p>
        </div>
        <Button
          variant="outline"
          className="cursor-pointer"
          onClick={() =>
            downloadCSV(
              (recharges ?? []).map((r) => ({
                Customer: r.customer?.username ?? "",
                Package: r.package?.name ?? "",
                Amount: r.amount,
                Date: r.date,
                Status: r.paid ? "Paid" : "Unpaid",
                Note: r.note ?? "",
              })),
              `payments-${todayISO()}.csv`
            )
          }
        >
          <Download className="w-4 h-4 mr-2" /> CSV
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by customer, package..."
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
        <p className="text-xs text-muted-foreground sm:ml-auto">{unpaid.length + paid.length} entries</p>
      </div>

      {/* Unpaid */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-500" />
              Outstanding ({unpaid.length})
            </CardTitle>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                <Button size="sm" onClick={handleBulkMarkPaid} disabled={bulkSaving} className="cursor-pointer whitespace-nowrap">
                  {bulkSaving ? "Saving..." : "Mark Selected Paid"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {recharges === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : unpaid.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">All caught up! No outstanding payments.</p>
          ) : (
            <div className="divide-y">
              <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30">
                <input
                  type="checkbox"
                  className="cursor-pointer"
                  checked={unpaid.length > 0 && selectedIds.size === unpaid.length}
                  onChange={toggleSelectAll}
                />
                <span className="text-xs font-medium text-muted-foreground">Select All</span>
              </div>
              {unpaid.map((r) => (
                <div key={r._id} className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      checked={selectedIds.has(r._id)}
                      onChange={() => toggleSelect(r._id)}
                    />
                    <div>
                      <p className="font-semibold text-sm">{r.customer?.username ?? "?"}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.package?.name ?? "-"} · {formatDate(r.date)}
                        {(Date.now() - new Date(r.date).getTime()) / 86400000 > 30 && (
                          <span className="ml-2 text-amber-600 font-medium">Overdue</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-end">
                    <span className="font-bold">{formatAmount(r.amount, settings)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(r._id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => navigate(`/receipt/${r._id}`)}
                    >
                      <FileText className="w-3 h-3 sm:mr-1" />
                      <span className="hidden sm:inline">Receipt</span>
                    </Button>
                    <Button
                      size="sm"
                      className="cursor-pointer"
                      onClick={() => { setPayingId(r._id); setPayDate(todayISO()); setPayNote(""); }}
                    >
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

      {/* Paid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Paid ({paid.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paid.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No paid recharges yet.</p>
          ) : (
            <div className="divide-y">
              {paid.map((r) => (
                <div key={r._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-sm">{r.customer?.username ?? "?"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.package?.name ?? "-"} · {formatDate(r.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-end">
                    <span className="font-bold">{formatAmount(r.amount, settings)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(r._id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => navigate(`/receipt/${r._id}`)}
                    >
                      <FileText className="w-3 h-3 sm:mr-1" />
                      <span className="hidden sm:inline">Receipt</span>
                    </Button>
                    <span className="text-green-600 text-xs font-medium bg-green-50 px-2 py-0.5 rounded-full">Paid</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
            <Button onClick={handleMarkPaid} disabled={saving} className="cursor-pointer">
              {saving ? "Saving..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Recharge Dialog */}
      <Dialog open={!!editRecharge} onOpenChange={(v) => !v && setEditRecharge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Recharge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Package</Label>
              <Select
                value={editRecharge?.packageId ?? ""}
                onValueChange={(v) => setEditRecharge((prev) => prev ? { ...prev, packageId: v } : null)}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  {packages?.map((p) => (
                    <SelectItem key={p._id} value={p._id} className="cursor-pointer">
                      {p.name} — {formatAmount(p.price, settings)} / {p.durationDays}d
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={editRecharge?.amount ?? ""}
                onChange={(e) => setEditRecharge((prev) => prev ? { ...prev, amount: e.target.value } : null)}
              />
              {selectedPkg && (
                <p className="text-xs text-muted-foreground mt-1">
                  Suggested: {formatAmount(selectedPkg.price, settings)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={editRecharge?.date ?? ""}
                onChange={(e) => setEditRecharge((prev) => prev ? { ...prev, date: e.target.value } : null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Input
                placeholder="Optional note"
                value={editRecharge?.note ?? ""}
                onChange={(e) => setEditRecharge((prev) => prev ? { ...prev, note: e.target.value } : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditRecharge(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving} className="cursor-pointer">
              {editSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recharge</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this recharge? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
              className="cursor-pointer"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
