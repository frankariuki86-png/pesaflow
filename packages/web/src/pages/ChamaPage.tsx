import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/authContext";
import { supabase } from "../services/supabase";

type Chama = { id: string; name: string; description: string | null; contribution_amount: number; contribution_frequency: string };
type Contribution = { id: string; chama_id: string; amount: number; status: string; contributed_at: string };
type Member = { id: string; chama_id: string; user_id: string };
const money = (value: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(value || 0);

export default function ChamaPage() {
  const { user } = useAuth();
  const [chamas, setChamas] = useState<Chama[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [chamaForm, setChamaForm] = useState({ name: "", description: "", contribution_amount: "", contribution_frequency: "MONTHLY" });
  const [contributionForm, setContributionForm] = useState({ amount: "", payment_method: "MPESA", reference: "" });

  const loadChamas = async () => {
    if (!user?.id) return;
    const { data, error: queryError } = await supabase
      .from("chama_members")
      .select("chama_id, status, role, chamas(id, name, description, contribution_amount, contribution_frequency)")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false });

    if (queryError) {
      setError("Unable to load your chamas.");
      return;
    }

    const loaded = ((data ?? []) as Array<{ chama_id: string; chamas: Chama[] | null }> )
      .flatMap((item) => item.chamas ?? [])
      .filter(Boolean) as Chama[];

    setChamas(loaded);
    setSelectedId((current) => current || loaded[0]?.id || "");
  };

  const loadGroupData = async () => {
    if (!selectedId) { setContributions([]); setMembers([]); setLoading(false); return; }
    setLoading(true);
    const [contributionResult, memberResult] = await Promise.all([
      supabase.from("chama_contributions").select("id, chama_id, amount, status, contributed_at").eq("chama_id", selectedId).order("contributed_at", { ascending: false }),
      supabase.from("chama_members").select("id, chama_id, user_id").eq("chama_id", selectedId),
    ]);
    if (contributionResult.error || memberResult.error) setError("Unable to load chama records.");
    else { setContributions((contributionResult.data as Contribution[]) ?? []); setMembers((memberResult.data as Member[]) ?? []); }
    setLoading(false);
  };

  useEffect(() => { void loadChamas(); }, [user?.id]);
  useEffect(() => { void loadGroupData(); }, [selectedId]);

  const totals = useMemo(() => ({ paid: contributions.filter((item) => item.status === "PAID").reduce((sum, item) => sum + Number(item.amount), 0), pending: contributions.filter((item) => item.status !== "PAID").reduce((sum, item) => sum + Number(item.amount), 0) }), [contributions]);

  const createChama = async (event: React.FormEvent) => {
    event.preventDefault(); if (!user?.id || !chamaForm.name.trim()) return;
    setSaving(true); setError("");
    const { data, error: insertError } = await supabase.from("chamas").insert({ owner_id: user.id, name: chamaForm.name.trim(), description: chamaForm.description.trim() || null, contribution_amount: Number(chamaForm.contribution_amount) || 0, contribution_frequency: chamaForm.contribution_frequency }).select("id, name, description, contribution_amount, contribution_frequency").single();
    if (insertError) setError("Unable to create chama."); else {
      const { error: memberError } = await supabase.from("chama_members").insert({ chama_id: data.id, user_id: user.id, role: "CHAIRPERSON", status: "ACTIVE" });
      if (memberError) {
        setError("Chama created, but owner membership could not be initialized.");
        setSaving(false);
        return;
      }
      setChamas((current) => [data as Chama, ...current]); setSelectedId(data.id); setChamaForm({ name: "", description: "", contribution_amount: "", contribution_frequency: "MONTHLY" }); setMessage("Chama created successfully.");
    }
    setSaving(false);
  };

  const addContribution = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selectedId || !user?.id) return;
    const amount = Number(contributionForm.amount); if (!Number.isFinite(amount) || amount <= 0) { setError("Enter a valid contribution amount."); return; }
    const member = members.find((item) => item.user_id === user.id); if (!member) { setError("Your chama membership is not available yet."); return; }
    setSaving(true); setError("");
    const { error: insertError } = await supabase.from("chama_contributions").insert({ chama_id: selectedId, member_id: member.id, amount, payment_method: contributionForm.payment_method, reference: contributionForm.reference.trim() || null, status: "PAID" });
    if (insertError) setError("Unable to record contribution."); else { setContributionForm({ amount: "", payment_method: "MPESA", reference: "" }); setMessage("Contribution recorded successfully."); await loadGroupData(); }
    setSaving(false);
  };

  if (chamas.length === 0) return <div className="p-6"><h1 className="text-3xl font-semibold text-navy">Chama manager</h1><form onSubmit={createChama} className="mt-6 max-w-xl rounded-3xl bg-white p-6 shadow-soft"><h2 className="text-xl font-semibold text-navy">Create your first chama</h2><div className="mt-5 space-y-4"><input required value={chamaForm.name} onChange={(event) => setChamaForm({ ...chamaForm, name: event.target.value })} placeholder="Chama name" className="w-full rounded-2xl border border-border px-4 py-3" /><input value={chamaForm.description} onChange={(event) => setChamaForm({ ...chamaForm, description: event.target.value })} placeholder="Description" className="w-full rounded-2xl border border-border px-4 py-3" /><input type="number" min="0" value={chamaForm.contribution_amount} onChange={(event) => setChamaForm({ ...chamaForm, contribution_amount: event.target.value })} placeholder="Contribution amount" className="w-full rounded-2xl border border-border px-4 py-3" /><button disabled={saving} className="rounded-2xl bg-emerald px-5 py-3 font-semibold text-white">{saving ? "Creating..." : "Create chama"}</button>{error && <p className="text-sm text-red-600">{error}</p>}</div></form></div>;

  const chama = chamas.find((item) => item.id === selectedId);
  return <div className="p-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Group money</p><h1 className="mt-2 text-3xl font-semibold text-navy">Chama manager</h1></div><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="rounded-2xl border border-border bg-white px-4 py-3">{chamas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>{error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{message && <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}{loading ? <div className="rounded-3xl bg-white p-6 text-muted shadow-soft">Loading chama data...</div> : <><div className="mb-6 grid gap-6 md:grid-cols-4"><Metric label="Contributions" value={money(totals.paid)} color="text-emerald" /><Metric label="Pending" value={money(totals.pending)} color="text-amber-600" /><Metric label="Members" value={members.length.toString()} color="text-sky-700" /><Metric label="Contribution" value={money(Number(chama?.contribution_amount))} color="text-navy" /></div><div className="grid gap-6 lg:grid-cols-3"><form onSubmit={addContribution} className="rounded-3xl bg-white p-6 shadow-soft"><h2 className="text-lg font-semibold text-navy">Record contribution</h2><div className="mt-4 space-y-3"><input required type="number" min="0" value={contributionForm.amount} onChange={(event) => setContributionForm({ ...contributionForm, amount: event.target.value })} placeholder="Amount" className="w-full rounded-xl border border-border px-3 py-2" /><select value={contributionForm.payment_method} onChange={(event) => setContributionForm({ ...contributionForm, payment_method: event.target.value })} className="w-full rounded-xl border border-border px-3 py-2"><option>MPESA</option><option>CASH</option><option>BANK</option></select><input value={contributionForm.reference} onChange={(event) => setContributionForm({ ...contributionForm, reference: event.target.value })} placeholder="Reference (optional)" className="w-full rounded-xl border border-border px-3 py-2" /><button disabled={saving} className="w-full rounded-xl bg-emerald px-3 py-2 font-semibold text-white">{saving ? "Saving..." : "Save contribution"}</button></div></form><div className="rounded-3xl bg-white p-6 shadow-soft lg:col-span-2"><h2 className="text-lg font-semibold text-navy">Contribution history</h2>{contributions.length === 0 ? <p className="mt-4 text-sm text-muted">No contributions recorded yet.</p> : <div className="mt-4 divide-y divide-border">{contributions.map((item) => <div key={item.id} className="flex items-center justify-between py-3"><div><p className="font-semibold text-text">{money(Number(item.amount))}</p><p className="text-sm text-muted">{new Date(item.contributed_at).toLocaleDateString()}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald">{item.status}</span></div>)}</div>}</div></div></>}</div>;
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) { return <div className="rounded-3xl bg-white p-6 shadow-soft"><p className="text-sm text-muted">{label}</p><p className={`mt-3 text-2xl font-semibold ${color}`}>{value}</p></div>; }
