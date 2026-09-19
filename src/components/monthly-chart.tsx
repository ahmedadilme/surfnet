import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api.ts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MonthlyChart() {
  const { data: monthlyRecharges } = useQuery({
    queryKey: ["recharges", "monthly"],
    queryFn: () => api.get("/recharges/monthly/all"),
  });
  const { data: monthlyExpenses } = useQuery({
    queryKey: ["expenses", "monthly"],
    queryFn: () => api.get("/expenses/monthly/all"),
  });

  if (monthlyRecharges === undefined || monthlyExpenses === undefined) {
    return <Skeleton className="h-72 w-full" />;
  }

  const expenseMap = new Map(monthlyExpenses.map((e) => [e.month, e.total]));
  const data = monthlyRecharges.map((r) => ({
    month: r.month,
    Billed: r.billed,
    Collected: r.collected,
    Expenses: expenseMap.get(r.month) ?? 0,
  }));

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 11 }} />
            <YAxis className="text-xs" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Billed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Collected" fill="#16a34a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
