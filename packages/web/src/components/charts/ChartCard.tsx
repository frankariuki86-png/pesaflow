import type { ReactNode } from "react";

export default function ChartCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-navy">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
