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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatAmount, useSettings } from "@/hooks/use-settings.ts";

type PkgForm = {
  name: string;
  price: string;
  speed: string;
  durationDays: string;
  description: string;
};

const EMPTY: PkgForm = { name: "", price: "", speed: "", durationDays: "30", description: "" };

export default function PackagesPage() {
  const queryClient = useQueryClient();
  const { data: packages } = useQuery({
    queryKey: ["packages"],
    queryFn: () => api.get("/packages"),
  });
  const settings = useSettings();
  const createPkg = useMutation({
    mutationFn: (data: { name: string; price: number; speed?: string; durationDays: number; description?: string }) =>
      api.post("/packages", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packages"] }),
  });
  const updatePkg = useMutation({
    mutationFn: (data: { id: string; name: string; price: number; speed?: string; durationDays: number; description?: string }) =>
      api.put("/packages/" + data.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packages"] }),
  });
  const removePkg = useMutation({
    mutationFn: (id: string) => api.delete("/packages/" + id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packages"] }),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PkgForm>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (p: { _id: string; name: string; price: number; speed?: string; durationDays: number; description?: string }) => {
    setForm({ name: p.name, price: String(p.price), speed: p.speed ?? "", durationDays: String(p.durationDays), description: p.description ?? "" });
    setEditId(p._id);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) { toast.error("Name and price are required"); return; }
    const price = parseFloat(form.price);
    const durationDays = parseInt(form.durationDays) || 30;
    if (isNaN(price) || price <= 0) { toast.error("Invalid price"); return; }
    setSaving(true);
    try {
      if (editId) {
        await updatePkg.mutateAsync({ id: editId, name: form.name, price, speed: form.speed || undefined, durationDays, description: form.description || undefined });
        toast.success("Package updated");
      } else {
        await createPkg.mutateAsync({ name: form.name, price, speed: form.speed || undefined, durationDays, description: form.description || undefined });
        toast.success("Package added");
      }
      setOpen(false);
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await removePkg.mutateAsync(id); toast.success("Deleted"); } catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start sm:items-center justify-between gap-2 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl font-bold">Packages</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage internet plans</p>
        </div>
        <Button onClick={openAdd} className="cursor-pointer"><Plus className="w-4 h-4 mr-2" />Add Package</Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages === undefined
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)
          : packages.length === 0
          ? <p className="text-muted-foreground text-sm col-span-3 py-6 text-center">No packages yet.</p>
          : packages.map((p) => (
            <Card key={p._id} className="relative">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold text-primary">{formatAmount(p.price, settings)}</p>
                <p className="text-xs text-muted-foreground">{p.durationDays} days{p.speed ? ` · ${p.speed}` : ""}</p>
                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="secondary" className="cursor-pointer" onClick={() => openEdit(p)}><Pencil className="w-3 h-3 mr-1" />Edit</Button>
                  <Button size="sm" variant="ghost" className="cursor-pointer text-destructive hover:text-destructive" onClick={() => handleDelete(p._id)}><Trash2 className="w-3 h-3 mr-1" />Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))
        }
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Package" : "Add Package"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Package Name *</Label><Input placeholder="Basic 10 Mbps" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Price ($) *</Label><Input type="number" placeholder="29.99" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Duration (days)</Label><Input type="number" placeholder="30" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Speed</Label><Input placeholder="10 Mbps" value={form.speed} onChange={(e) => setForm({ ...form, speed: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Input placeholder="Optional notes" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer">{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
