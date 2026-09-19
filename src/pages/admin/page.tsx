import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Shield, UserPlus, Trash2 } from "lucide-react";

export default function AdminPage() {
  const queryClient = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ["auth", "list-users"],
    queryFn: () => api.get("/auth/list-users"),
  });
  const createUser = useMutation({
    mutationFn: (data: { name: string; email: string; password: string; role: string }) =>
      api.post("/auth/create-user", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "list-users"] }),
  });
  const removeUser = useMutation({
    mutationFn: (userId: string) => api.delete("/auth/" + userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "list-users"] }),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("All fields are required");
      return;
    }
    setSaving(true);
    try {
      await createUser.mutateAsync({ name: name.trim(), email: email.trim(), password, role: "staff" });
      toast.success("Staff account created!");
      setName("");
      setEmail("");
      setPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeUser.mutateAsync(userId);
      toast.success("Account removed");
      setConfirmRemove(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove account");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage staff accounts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" /> Create Staff Account
          </CardTitle>
          <CardDescription>
            Staff can manage customers, packages, recharges, and payments but cannot access settings or this admin page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input placeholder="Staff name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="staff@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button onClick={handleCreate} disabled={saving} className="w-full cursor-pointer">
            {saving ? "Creating..." : "Create Staff Account"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Staff Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No accounts yet
            </p>
          ) : (
            <div className="divide-y">
              {users.map((u) => (
                <div key={u._id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-medium text-sm">{u.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.role === "admin"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {u.role ?? "staff"}
                    </span>
                    {u.role !== "admin" && confirmRemove === u._id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs cursor-pointer"
                          onClick={() => handleRemove(u._id)}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs cursor-pointer"
                          onClick={() => setConfirmRemove(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : u.role !== "admin" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                        title="Remove account"
                        onClick={() => setConfirmRemove(u._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
