import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSettings, formatAmount } from "@/hooks/use-settings.ts";
import { MonthlyChart } from "@/components/monthly-chart.tsx";
import { DollarSign, AlertCircle, CheckCircle, Users, Receipt, TrendingUp, FileText, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Index() {
  const queryClient = useQueryClient();
  const { data: stats } = useQuery({
    queryKey: ["recharges", "stats"],
    queryFn: () => api.get("/recharges/stats/all"),
  });
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers"),
  });
  const { data: recentRecharges } = useQuery({
    queryKey: ["recharges"],
    queryFn: () => api.get("/recharges"),
  });
  const removeRecharge = useMutation({
    mutationFn: (id: string) => api.delete("/recharges/" + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recharges"] });
      queryClient.invalidateQueries({ queryKey: ["recharges", "stats"] });
    },
  });
  const { data: expenseStats } = useQuery({
    queryKey: ["expenses", "stats"],
    queryFn: () => api.get("/expenses/stats/all"),
  });
  const { data: recentExpenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api.get("/expenses"),
  });
  const settings = useSettings();
  const navigate = useNavigate();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const isLoading = stats === undefined;

  const handleDelete = async (id: string) => {
    try {
      await removeRecharge.mutateAsync(id);
      toast.success("Recharge deleted");
      setDeleteId(null);
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of your ISP billing
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))
        ) : (
          <>
            <StatCard
              title="Total Billed"
              value={formatAmount(stats.totalBilled, settings)}
              icon={<DollarSign className="w-5 h-5" />}
              color="text-primary"
            />
            <StatCard
              title="Total Collected"
              value={formatAmount(stats.totalPaid, settings)}
              icon={<CheckCircle className="w-5 h-5" />}
              color="text-green-600"
            />
            <StatCard
              title="Outstanding"
              value={formatAmount(stats.totalUnpaid, settings)}
              icon={<AlertCircle className="w-5 h-5" />}
              color="text-amber-500"
            />
            <StatCard
              title="Customers"
              value={String(customers?.length ?? 0)}
              icon={<Users className="w-5 h-5" />}
              color="text-accent"
            />
            <StatCard
              title="Total Expenses"
              value={formatAmount(expenseStats?.totalExpenses ?? 0, settings)}
              icon={<Receipt className="w-5 h-5" />}
              color="text-destructive"
            />
            <StatCard
              title="Profit / Loss"
              value={formatAmount((stats.totalPaid ?? 0) - (expenseStats?.totalExpenses ?? 0), settings)}
              icon={<TrendingUp className="w-5 h-5" />}
              color={(stats.totalPaid ?? 0) - (expenseStats?.totalExpenses ?? 0) >= 0 ? "text-green-600" : "text-destructive"}
            />
          </>
        )}
      </div>

      <MonthlyChart />

      {/* Recent Recharges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Recharges</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRecharges === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentRecharges.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No recharges yet
            </p>
          ) : (
            <div className="divide-y">
              {recentRecharges.slice(0, 10).map((r) => (
                <div
                  key={r._id}
                  className="flex items-center justify-between py-2.5"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {r.customer?.username ?? "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.package?.name ?? "-"} · {r.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-end">
                    <span className="font-semibold text-sm whitespace-nowrap">
                      {formatAmount(r.amount, settings)}
                    </span>
                    <span
                      className={
                        r.paid
                          ? "text-green-600 text-xs font-medium whitespace-nowrap"
                          : "text-amber-500 text-xs font-medium whitespace-nowrap"
                      }
                    >
                      {r.paid ? "Paid" : "Unpaid"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer"
                      onClick={() => navigate(`/receipt/${r._id}`)}
                    >
                      <FileText className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer hidden sm:inline-flex"
                      onClick={() => navigate("/payments")}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    {deleteId === r._id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs cursor-pointer"
                          onClick={() => handleDelete(r._id)}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs cursor-pointer"
                          onClick={() => setDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="cursor-pointer text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(r._id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Expenses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {recentExpenses === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : recentExpenses.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No expenses yet.</p>
          ) : (
            <div className="divide-y">
              {recentExpenses.slice(0, 10).map((e) => (
                <div key={e._id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-medium text-sm">{e.description}</p>
                    <p className="text-xs text-muted-foreground">{e.category} · {e.date}</p>
                  </div>
                  <span className="font-semibold text-sm text-destructive">{formatAmount(e.amount, settings)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
    <Card>
      <CardContent className="pt-5">
        <div className={cn("mb-2", color)}>{icon}</div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{title}</p>
      </CardContent>
    </Card>
  );
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
