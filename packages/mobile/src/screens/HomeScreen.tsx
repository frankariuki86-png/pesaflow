import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../services/supabase";

type Transaction = {
  id: string;
  description: string | null;
  amount: number;
  direction: "INCOME" | "EXPENSE" | "TRANSFER";
  category: string;
  occurred_at: string;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(amount || 0);

export default function HomeScreen() {
  const { session } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ income: 0, expenses: 0, balance: 0, savings: 0 });

  useEffect(() => {
    const loadData = async () => {
      if (!session?.user.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [transactionsResult, summaryResult] = await Promise.all([
          supabase
            .from("transactions")
            .select("id, description, amount, direction, category, occurred_at")
            .eq("user_id", session.user.id)
            .order("occurred_at", { ascending: false })
            .limit(8),
          supabase.rpc("get_personal_finance_summary", { p_user_id: session.user.id }),
        ]);

        if (transactionsResult.error) throw transactionsResult.error;
        if (summaryResult.error) throw summaryResult.error;

        const summaryRow = summaryResult.data?.[0] ?? summaryResult.data ?? null;
        setTransactions((transactionsResult.data as Transaction[]) ?? []);
        setSummary({
          income: Number(summaryRow?.income_total ?? 0),
          expenses: Number(summaryRow?.expense_total ?? 0),
          balance: Number(summaryRow?.available_money ?? 0),
          savings: Number(summaryRow?.savings_balance ?? 0),
        });
      } catch (loadError) {
        console.error("Failed to load mobile dashboard summary", loadError);
        setError("Unable to load your financial summary.");
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, [session?.user.id]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>Welcome back</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString("en-KE", { dateStyle: "long" })}</Text>
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.label}>Net balance</Text>
              <Text style={styles.balanceValue}>{formatCurrency(summary.balance)}</Text>
              <Text style={styles.caption}>Based on your actual savings and goal activity</Text>
            </View>
            <View style={styles.row}>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="arrow-down" color="#10B981" size={20} />
                <Text style={styles.statLabel}>Income</Text>
                <Text style={styles.statValue}>{formatCurrency(summary.income)}</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="arrow-up" color="#EF4444" size={20} />
                <Text style={styles.statLabel}>Expenses</Text>
                <Text style={styles.statValue}>{formatCurrency(summary.expenses)}</Text>
              </View>
            </View>
            <View style={styles.savingsCard}>
              <Text style={styles.label}>Savings</Text>
              <Text style={styles.savingsValue}>{formatCurrency(summary.savings)}</Text>
            </View>
          </>
        )}
        <Text style={styles.sectionTitle}>Recent transactions</Text>
        {loading ? <ActivityIndicator color="#10B981" /> : transactions.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No transactions yet.</Text></View>
        ) : transactions.map((transaction) => (
          <View key={transaction.id} style={styles.transaction}>
            <View style={[styles.txIcon, { backgroundColor: transaction.direction === "INCOME" ? "#E0F9F0" : "#FEE2E2" }]}>
              <MaterialCommunityIcons name={transaction.direction === "INCOME" ? "arrow-down" : "arrow-up"} color={transaction.direction === "INCOME" ? "#10B981" : "#EF4444"} size={20} />
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txDescription}>{transaction.description || "Manual entry"}</Text>
              <Text style={styles.txDate}>{transaction.category} • {new Date(transaction.occurred_at).toLocaleDateString()}</Text>
            </View>
            <Text style={[styles.txAmount, { color: transaction.direction === "INCOME" ? "#10B981" : "#EF4444" }]}>
              {transaction.direction === "INCOME" ? "+" : "-"}{formatCurrency(Number(transaction.amount))}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F8FA" },
  content: { padding: 16, paddingTop: 24 },
  greeting: { fontSize: 26, fontWeight: "700", color: "#17212B" },
  date: { fontSize: 14, color: "#667085", marginTop: 4, marginBottom: 22 },
  balanceCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  savingsCard: { backgroundColor: "#E0F2FE", borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  label: { color: "#667085", fontSize: 13 },
  balanceValue: { color: "#17212B", fontSize: 32, fontWeight: "700", marginTop: 8 },
  savingsValue: { color: "#075985", fontSize: 24, fontWeight: "700", marginTop: 8 },
  caption: { color: "#667085", fontSize: 12, marginTop: 8 },
  errorCard: { backgroundColor: "#FEE2E2", borderRadius: 12, padding: 14, marginBottom: 16 },
  errorText: { color: "#991B1B", fontSize: 13, fontWeight: "600" },
  row: { flexDirection: "row", gap: 12, marginBottom: 18 },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statLabel: { color: "#667085", fontSize: 12, marginTop: 8 },
  statValue: { color: "#17212B", fontSize: 16, fontWeight: "700", marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#17212B", marginBottom: 12 },
  transaction: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", padding: 14, borderRadius: 12, marginBottom: 8 },
  txIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 12 },
  txInfo: { flex: 1 },
  txDescription: { fontSize: 14, fontWeight: "600", color: "#17212B" },
  txDate: { fontSize: 12, color: "#667085", marginTop: 3 },
  txAmount: { fontSize: 13, fontWeight: "700" },
  empty: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 20 },
  emptyText: { color: "#667085" },
});
