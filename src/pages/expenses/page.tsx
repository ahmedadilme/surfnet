import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api.ts";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Receipt, Search, Download } from "lucide-react";
import { formatDate, todayISO, downloadCSV } from "@/lib/utils.ts";
import { useSettings, formatAmount } from "@/hooks/use-settings.ts";

const CATEGORIES = [
  { value: "bandwidth", label: "Bandwidth" },
  { value: "subscription", label: "Subscription" },
  { value: "service", label: "Service" },
  { value: "other", label: "Other" },
];

type ExpenseForm = {
  description: string;
  amount: string;
  category: string;
  date: string;
  note: string;
};

const EMPTY: ExpenseForm = { description: "", amount: "", category: "other", date: todayISO(), note: "" };

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const { data: expenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api.get("/expenses"),
  });
  const { data: expenseStats } = useQuery({
    queryKey: ["expenses", "stats"],
    queryFn: () => api.get("/expenses/stats/all"),
  });
  const createExpense = useMutation({
    mutationFn: (data: { description: string; amount: number; category: string; date: string; note?: string }) =>
      api.post("/expenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses", "stats"] });
    },
  });
  const updateExpense = useMutation({
    mutationFn: (data: { id: string; description: string; amount: number; category: string; date: string; note?: string }) =>
      api.put("/expenses/" + data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses", "stats"] });
    },
  });
  const removeExpense = useMutation({
    mutationFn: (id: string) => api.delete("/expenses/" + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses", "stats"] });
    },
  });
  const settings = useSettings();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const openAdd = () => { setForm(EMPTY); setEditId(null); setOpen(true); };

  const openEdit = (e: NonNullable<typeof expenses>[number]) => {
    if (!e) return;
    setForm({ description: e.description, amount: String(e.amount), category: e.category, date: e.date, note: e.note ?? "" });
    setEditId(e._id);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.description.trim() || !form.amount) { toast.error("Description and amount are required"); return; }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { toast.error("Invalid amount"); return; }
    setSaving(true);
    try {
      if (editId) {
        await updateExpense.mutateAsync({ id: editId, description: form.description.trim(), amount, category: form.category, date: form.date, note: form.note || undefined });
        toast.success("Expense updated");
      } else {
        await createExpense.mutateAsync({ description: form.description.trim(), amount, category: form.category, date: form.date, note: form.note || undefined });
        toast.success("Expense added");
      }
      setOpen(false);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeExpense.mutateAsync(id);
      toast.success("Expense deleted");
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete");
    }
  };

  const categoryLabel = (val: string) => CATEGORIES.find((c) => c.value === val)?.label ?? val;
  const categoryColor = (val: string) => {
    const map: Record<string, string> = {
      bandwidth: "text-blue-600 bg-blue-50",
      subscription: "text-purple-600 bg-purple-50",
      service: "text-amber-600 bg-amber-50",
      other: "text-gray-600 bg-gray-100",
    };
    return map[val] ?? map.other;
  };

  const query = search.toLowerCase();
  const filtered = expenses?.filter((e) => {
    if (filter !== "all" && e.category !== filter) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    if (query && !e.description.toLowerCase().includes(query) && !(e.note ?? "").toLowerCase().includes(query) && !categoryLabel(e.category).toLowerCase().includes(query)) return false;
    return true;
  });
  const totalDisplay = filtered?.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start sm:items-center justify-between gap-2 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground text-sm mt-1">Track operational costs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() =>
              downloadCSV(
                (expenses ?? []).map((e) => ({
                  Description: e.description,
                  Amount: e.amount,
                  Category: categoryLabel(e.category),
                  Date: e.date,
                  Note: e.note ?? "",
                })),
                `expenses-${todayISO()}.csv`
              )
            }
          >
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button onClick={openAdd} className="cursor-pointer">
            <Plus className="w-4 h-4 mr-2" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{formatAmount(expenseStats?.totalExpenses ?? 0, settings)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Expenses</p>
          </CardContent>
        </Card>
        {CATEGORIES.map((cat) => (
          <Card key={cat.value}>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{formatAmount(expenseStats?.byCategory?.[cat.value] ?? 0, settings)}</p>
              <p className="text-xs text-muted-foreground mt-1">{cat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Label className="text-sm shrink-0 hidden sm:inline">Category:</Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-40 cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="cursor-pointer">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value} className="cursor-pointer">{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-28 sm:w-36" placeholder="From" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-28 sm:w-36" placeholder="To" />
        </div>
        <p className="text-xs text-muted-foreground sm:ml-auto">{filtered?.length ?? 0} entries · {formatAmount(totalDisplay, settings)}</p>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {expenses === undefined ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered?.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No expenses found.</p>
          ) : (
            <div className="divide-y">
              {filtered?.map((e) => (
                <div key={e._id} className="flex items-center justify-between py-3 px-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{e.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${categoryColor(e.category)}`}>{categoryLabel(e.category)}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
                      {e.note && <span className="text-xs text-muted-foreground truncate">· {e.note}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <span className="font-bold text-sm">{formatAmount(e.amount, settings)}</span>
                    <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openEdit(e)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(e._id)}
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

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Input placeholder="e.g. Bandwidth upgrade" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value} className="cursor-pointer">{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Input placeholder="Optional details" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
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
            <DialogTitle>Delete Expense</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="cursor-pointer">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
