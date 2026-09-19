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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSettings, formatAmount } from "@/hooks/use-settings.ts";

type CustomerForm = {
  username: string;
  name: string;
  phone: string;
  address: string;
};

const EMPTY: CustomerForm = { username: "", name: "", phone: "", address: "" };

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers"),
  });
  const { data: unpaidTotals } = useQuery({
    queryKey: ["recharges", "unpaidTotals"],
    queryFn: () => api.get("/recharges/unpaid-totals/all"),
  });
  const { data: invoiceUnpaidTotals } = useQuery({
    queryKey: ["invoices", "unpaidTotals"],
    queryFn: () => api.get("/invoices/unpaid-totals/all"),
  });
  const createCustomer = useMutation({
    mutationFn: (data: { username: string; name: string; phone?: string; address?: string }) =>
      api.post("/customers", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
  const updateCustomer = useMutation({
    mutationFn: (data: { id: string; username: string; name: string; phone?: string; address?: string }) =>
      api.put("/customers/" + data.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
  const removeCustomer = useMutation({
    mutationFn: (id: string) => api.delete("/customers/" + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
  const navigate = useNavigate();
  const settings = useSettings();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setForm(EMPTY);
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (c: { _id: string; username: string; name: string; phone?: string; address?: string }) => {
    setForm({ username: c.username, name: c.name, phone: c.phone ?? "", address: c.address ?? "" });
    setEditId(c._id);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.name.trim()) {
      toast.error("Username and name are required");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await updateCustomer.mutateAsync({ id: editId, ...form, phone: form.phone || undefined, address: form.address || undefined });
        toast.success("Customer updated");
      } else {
        await createCustomer.mutateAsync({ ...form, phone: form.phone || undefined, address: form.address || undefined });
        toast.success("Customer added");
      }
      setOpen(false);
    } catch {
      toast.error("Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeCustomer.mutateAsync(id);
      toast.success("Customer deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start sm:items-center justify-between gap-2 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your ISP subscribers</p>
        </div>
        <Button onClick={openAdd} className="cursor-pointer shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Customers ({customers?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {customers === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : customers.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">No customers yet. Add one to get started.</p>
          ) : (
            <div className="divide-y">
              {customers.map((c) => (
                <div key={c._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-sm">{c.username}</p>
                    <p className="text-xs text-muted-foreground">{c.name}{c.phone ? ` · ${c.phone}` : ""}</p>
                    {c.address && <p className="text-xs text-muted-foreground">{c.address}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {(unpaidTotals?.[c._id] ?? 0) + (invoiceUnpaidTotals?.[c._id] ?? 0) > 0 ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" />
                        {formatAmount((unpaidTotals?.[c._id] ?? 0) + (invoiceUnpaidTotals?.[c._id] ?? 0), settings)}
                      </span>
                    ) : null}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => navigate(`/statement/${c._id}`)}
                    >
                      <FileText className="w-3 h-3 mr-1" /> Statement
                    </Button>
                    <Button size="icon" variant="ghost" className="cursor-pointer" onClick={() => openEdit(c)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      onClick={() => handleDelete(c._id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Username *</Label>
              <Input placeholder="john_doe" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input placeholder="John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+1 555 0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="123 Main St" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
    </div>
  );
}
