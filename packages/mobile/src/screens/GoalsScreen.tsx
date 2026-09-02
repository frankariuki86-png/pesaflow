import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../services/supabase";

type Goal = { id: string; name: string; target_amount: number; achievement_percentage: number; completion_percentage: number; current_balance: number; status: "ACTIVE" | "ACHIEVED" | "COMPLETED" };
const formatCurrency = (amount: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(Number(amount) || 0);

export default function GoalsScreen() {
  const { session } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGoals = async () => {
      if (!session?.user.id) return;
      const { data } = await supabase.from("goal_metrics").select("id, name, target_amount, achievement_percentage, completion_percentage, current_balance, status").eq("user_id", session.user.id).order("created_at", { ascending: false });
      setGoals((data as Goal[]) ?? []);
      setLoading(false);
    };
    void loadGoals();
  }, [session?.user.id]);

  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Goals</Text>
    {loading ? <ActivityIndicator color="#10B981" /> : goals.length === 0 ? <Text style={styles.muted}>No goals yet.</Text> : goals.map((goal) => (
      <View key={goal.id} style={styles.goal}>
        <View style={styles.header}><Text style={styles.name}>{goal.name}</Text><Text style={styles.status}>{goal.status}</Text></View>
        <Text style={styles.metric}>{Number(goal.achievement_percentage).toFixed(2)}% ACHIEVED</Text>
        <Text style={styles.metric}>{Number(goal.completion_percentage).toFixed(0)}% COMPLETE</Text>
        <Text style={styles.balance}>{formatCurrency(Number(goal.current_balance))} REMAINING BALANCE</Text>
        <Text style={styles.target}>Target {formatCurrency(Number(goal.target_amount))}</Text>
      </View>
    ))}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F8FA" }, content: { padding: 16, paddingTop: 24 },
  title: { fontSize: 28, fontWeight: "700", color: "#17212B", marginBottom: 18 }, goal: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 18, marginBottom: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, name: { fontSize: 18, fontWeight: "700", color: "#17212B" }, status: { color: "#047857", fontSize: 11, fontWeight: "700" },
  metric: { color: "#047857", fontSize: 15, fontWeight: "700", marginTop: 12 }, balance: { color: "#17212B", fontSize: 15, fontWeight: "700", marginTop: 12 }, target: { color: "#667085", fontSize: 12, marginTop: 8 }, muted: { color: "#667085" },
});