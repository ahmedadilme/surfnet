import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Search, History } from "lucide-react";
import { formatDateTime, todayISO, downloadCSV } from "@/lib/utils.ts";

const GROUP_META: Record<string, { label: string; badge: string }> = {
  system: { label: "System", badge: "bg-blue-50 text-blue-700" },
  auth: { label: "Auth", badge: "bg-blue-50 text-blue-700" },
  user: { label: "User", badge: "bg-purple-50 text-purple-700" },
  customer: { label: "Customer", badge: "bg-cyan-50 text-cyan-700" },
  package: { label: "Package", badge: "bg-teal-50 text-teal-700" },
  recharge: { label: "Recharge", badge: "bg-amber-50 text-amber-700" },
  expense: { label: "Expense", badge: "bg-red-50 text-red-700" },
  invoice: { label: "Invoice", badge: "bg-indigo-50 text-indigo-700" },
  quotation: { label: "Quotation", badge: "bg-slate-100 text-slate-700" },
  settings: { label: "Settings", badge: "bg-gray-100 text-gray-700" },
};

const GROUP_ORDER = Object.keys(GROUP_META);

export function ActivityLogCard({
  users,
}: {
  users: { _id: string; name?: string; email?: string; role?: string }[];
}) {
  const { data: logs } = useQuery({
    queryKey: ["activity"],
    queryFn: () => api.get("/activity"),
  });

  const [userId, setUserId] = useState("__all__");
  const [group, setGroup] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const groups = useMemo(() => {
    const present = new Set((logs ?? []).map((l: { action: string }) => l.action.split(".")[0]));
    return GROUP_ORDER.filter((g) => present.has(g));
  }, [logs]);

  const filtered = useMemo(() => {
    const items = logs ?? [];
    const q = search.toLowerCase();
    return items.filter((l: { userId?: string; action: string; detail?: string; createdAt: string }) => {
      const groupOf = l.action.split(".")[0];
      if (userId !== "__all__" && l.userId !== userId) return false;
      if (group !== "all" && groupOf !== group) return false;
      if (dateFrom && l.createdAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && l.createdAt.slice(0, 10) > dateTo) return false;
      if (q && !(l.detail ?? "").toLowerCase().includes(q) && !l.action.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, userId, group, search, dateFrom, dateTo]);

  const handleExport = () => {
    downloadCSV(
      filtered.map((l: { userLabel?: string; user?: { name?: string; email?: string } | null; action: string; detail?: string; createdAt: string }) => ({
        Time: formatDateTime(l.createdAt),
        User: l.user ? `${l.user.name ?? ""} (${l.user.email ?? ""})` : l.userLabel ?? "Deleted user",
        Action: l.action,
        Detail: l.detail ?? "",
      })),
      `activity-${todayISO()}.csv`
    );
  };

  const userLabel = (l: { user?: { name?: string; email?: string; role?: string } | null; userLabel?: string }) => {
    if (l.user) return `${l.user.name ?? "Unknown"} (${l.user.email ?? ""})`;
    return l.userLabel || "Deleted user";
  };

  const roleBadge = (role: string) =>
    role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-primary" /> Activity Log
          </CardTitle>
          <Button variant="outline" size="sm" className="cursor-pointer shrink-0" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search activity..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-full sm:w-44 h-9 cursor-pointer">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="cursor-pointer">All users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u._id} value={u._id} className="cursor-pointer">
                    {u.name ?? u.email ?? "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger className="w-full sm:w-40 h-9 cursor-pointer">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="cursor-pointer">All types</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g} value={g} className="cursor-pointer">
                    {GROUP_META[g]?.label ?? g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-28 sm:w-36" placeholder="From" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-28 sm:w-36" placeholder="To" />
          </div>
          <p className="text-xs text-muted-foreground sm:ml-auto">{filtered.length} entries</p>
        </div>

        {/* List */}
        {logs === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">No activity matches your filters.</p>
        ) : (
          <div className="divide-y max-h-[480px] overflow-y-auto">
            {filtered.map((l: { _id: string; user?: { name?: string; email?: string; role?: string } | null; userLabel?: string; userId?: string; action: string; detail?: string; createdAt: string }) => {
              const groupOf = l.action.split(".")[0];
              const meta = GROUP_META[groupOf];
              return (
                <div key={l._id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{userLabel(l)}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadge(l.user?.role ?? "staff")}`}>
                          {l.user?.role ?? "staff"}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta?.badge ?? "bg-gray-100 text-gray-700"}`}>
                          {meta?.label ?? groupOf}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1 break-words">{l.detail ?? l.action}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">{formatDateTime(l.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}