import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#10B981", "#14B8A6", "#22D3EE", "#A78BFA", "#F59E0B", "#F97316", "#EF4444", "#64748B"];

export default function ExpenseCategoryChart({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!data.length) {
    return <div className="rounded-2xl border border-dashed border-border bg-slate-50 p-6 text-sm text-muted">No expense category data yet.</div>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={4}>
              {data.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `KES ${Number(value).toLocaleString()}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span className="text-sm text-text">{item.name}</span>
            </div>
            <span className="text-sm font-semibold text-navy">KES {Number(item.value).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
