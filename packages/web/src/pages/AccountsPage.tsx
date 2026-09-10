import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/authContext";
import { supabase } from "../services/supabase";

type Account = {
  id: string;
  name: string;
  type: "CASH" | "MPESA" | "BANK" | "SAVINGS" | "OTHER";
  opening_balance: number;
  currency: string;
  status: string;
  created_at: string;
  current_balance?: number;
};

const formatCurrency = (amount: number) => new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 2,
}).format(amount || 0);

const normalizeAccountType = (value: string) => {
  switch (value) {
    case "CASH":
      return "Cash";
    case "MPESA":
      return "M-Pesa";
    case "BANK":
      return "Bank";
    case "SAVINGS":
      return "Savings";
    default:
      return "Other";
  }
};

export default function AccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [accountForm, setAccountForm] = useState({ name: "", type: "CASH" as Account["type"], opening_balance: "", currency: "KES" });
  const [transferForm, setTransferForm] = useState({ fromAccountId: "", toAccountId: "", amount: "", note: "" });

  const loadAccounts = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("accounts")
      .select("id, name, type, opening_balance, currency, status, created_at")
      .eq("user_id", user.id)
      .order("name");

    if (queryError) {
      setError("Unable to load accounts.");
      setLoading(false);
      return;
    }

    const loadedAccounts = (data as Account[]) ?? [];
    const resolved = await Promise.all(loadedAccounts.map(async (account) => {
      const { data: balanceData, error: balanceError } = await supabase.rpc("get_account_balance", {
        p_user_id: user.id,
        p_account_id: account.id,
      });

      return {
        ...account,
        current_balance: balanceError ? 0 : Number(balanceData ?? 0),
      };
    }));

    setAccounts(resolved);
    setTransferForm((current) => ({
      ...current,
      fromAccountId: current.fromAccountId || resolved[0]?.id || "",
      toAccountId: current.toAccountId || resolved[1]?.id || resolved[0]?.id || "",
    }));
    setError("");
    setLoading(false);
  };

  useEffect(() => { void loadAccounts(); }, [user?.id]);

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + Number(account.current_balance ?? account.opening_balance), 0),
    [accounts],
  );

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    const name = accountForm.name.trim();
    const openingBalance = Number(accountForm.opening_balance);
    if (!name || Number.isNaN(openingBalance) || openingBalance < 0) {
      setError("Please provide a valid account name and opening balance.");
      return;
    }

    const { error: insertError } = await supabase.from("accounts").insert({
      user_id: user.id,
      name,
      type: accountForm.type,
      opening_balance: openingBalance,
      currency: accountForm.currency,
      status: "ACTIVE",
    });

    if (insertError) {
      setError(insertError.message || "Unable to create account.");
      return;
    }

    setAccountForm({ name: "", type: "CASH", opening_balance: "", currency: "KES" });
    setMessage("Account created successfully.");
    await loadAccounts();
  };

  const handleTransfer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    const amount = Number(transferForm.amount);
    if (!transferForm.fromAccountId || !transferForm.toAccountId || !Number.isFinite(amount) || amount <= 0) {
      setError("Select two accounts and enter a valid amount.");
      return;
    }

    const { data, error: transferError } = await supabase.rpc("transfer_between_accounts", {
      p_user_id: user.id,
      p_from_account_id: transferForm.fromAccountId,
      p_to_account_id: transferForm.toAccountId,
      p_amount: amount,
      p_note: transferForm.note.trim() || "Transfer between accounts",
      p_occurred_at: new Date().toISOString(),
    });

    if (transferError) {
      setError(transferError.message || "Transfer failed.");
      return;
    }

    setMessage(`Transfer complete: ${String((data as { amount?: number })?.amount ?? amount)}`);
    setTransferForm({ fromAccountId: transferForm.fromAccountId, toAccountId: transferForm.toAccountId, amount: "", note: "" });
    await loadAccounts();
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Connected money</p>
          <h1 className="mt-2 text-3xl font-semibold text-navy">Accounts</h1>
        </div>
      </div>

      {error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <div className="mb-6 grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-soft">
          <p className="text-sm text-muted">Total account value</p>
          <h2 className="mt-4 text-3xl font-semibold text-navy">{formatCurrency(totalBalance)}</h2>
        </div>
        <div className="rounded-3xl bg-sky-50 p-6 shadow-soft">
          <p className="text-sm text-sky-700">Accounts</p>
          <h2 className="mt-4 text-3xl font-semibold text-sky-700">{accounts.length}</h2>
        </div>
        <div className="rounded-3xl bg-emerald-50 p-6 shadow-soft">
          <p className="text-sm text-emerald">Active</p>
          <h2 className="mt-4 text-3xl font-semibold text-emerald">{accounts.filter((item) => item.status === "ACTIVE").length}</h2>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={handleCreateAccount} className="rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-navy">Create account</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text">Account name</label>
              <input value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="Savings" />
            </div>

            <div>
              <label className="block text-sm font-medium text-text">Type</label>
              <select value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value as Account["type"] })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3">
                <option value="CASH">Cash</option>
                <option value="MPESA">M-Pesa</option>
                <option value="BANK">Bank</option>
                <option value="SAVINGS">Savings</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text">Opening balance</label>
              <input type="number" min="0" step="0.01" value={accountForm.opening_balance} onChange={(event) => setAccountForm({ ...accountForm, opening_balance: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="0.00" />
            </div>

            <div>
              <label className="block text-sm font-medium text-text">Currency</label>
              <input value={accountForm.currency} onChange={(event) => setAccountForm({ ...accountForm, currency: event.target.value.toUpperCase() })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="KES" />
            </div>

            <button type="submit" className="w-full rounded-2xl bg-emerald px-4 py-3 font-semibold text-white">Add account</button>
          </div>
        </form>

        <form onSubmit={handleTransfer} className="rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-navy">Transfer between accounts</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text">From</label>
              <select value={transferForm.fromAccountId} onChange={(event) => setTransferForm({ ...transferForm, fromAccountId: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3">
                <option value="">Select source</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text">To</label>
              <select value={transferForm.toAccountId} onChange={(event) => setTransferForm({ ...transferForm, toAccountId: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3">
                <option value="">Select destination</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text">Amount</label>
              <input type="number" min="0" step="0.01" value={transferForm.amount} onChange={(event) => setTransferForm({ ...transferForm, amount: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="5000" />
            </div>

            <div>
              <label className="block text-sm font-medium text-text">Note</label>
              <input value={transferForm.note} onChange={(event) => setTransferForm({ ...transferForm, note: event.target.value })} className="mt-2 w-full rounded-2xl border border-border px-4 py-3" placeholder="Move to savings" />
            </div>

            <button type="submit" className="w-full rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white">Transfer funds</button>
          </div>
        </form>
      </div>

      <div className="mt-8 overflow-x-auto rounded-3xl bg-white shadow-soft">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-5 gap-4 border-b border-border px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            <div>Account</div>
            <div>Type</div>
            <div>Opening</div>
            <div>Balance</div>
            <div>Status</div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-muted">Loading accounts...</div>
          ) : accounts.length === 0 ? (
            <div className="p-6 text-sm text-muted">No accounts yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {accounts.map((account) => (
                <div key={account.id} className="grid grid-cols-5 gap-4 px-6 py-4 text-sm text-text">
                  <div className="font-semibold">{account.name}</div>
                  <div>{normalizeAccountType(account.type)}</div>
                  <div>{formatCurrency(account.opening_balance)}</div>
                  <div className="font-semibold text-navy">{formatCurrency(account.current_balance ?? account.opening_balance)}</div>
                  <div>{account.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
