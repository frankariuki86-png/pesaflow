import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../services/supabase";

type GoalStatus = "ACTIVE" | "ACHIEVED" | "COMPLETED";

type GoalRow = {
  id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  achievement_percentage: number;
  completion_percentage: number;
  current_balance: number;
  status: GoalStatus;
  completed_at: string | null;
  created_at: string;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const today = () => new Date().toISOString().slice(0, 10);
const defaultTargetDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 90);
  return date.toISOString().slice(0, 10);
};

const getUserMessage = (message: string | null | undefined) => {
  if (!message) return "Unable to complete this goal action.";
  if (message.toLowerCase().includes("unauthorized")) return "You are not allowed to update this goal.";
  if (message.toLowerCase().includes("goal not found")) return "This goal could not be found.";
  if (message.toLowerCase().includes("insufficient goal balance")) return "The goal balance is too low for this amount.";
  if (message.toLowerCase().includes("completed goals")) return "This goal is already completed and locked.";
  if (message.toLowerCase().includes("goal is required")) return "Please choose a goal.";
  if (message.toLowerCase().includes("greater than zero")) return "Enter an amount greater than zero.";
  return "The change could not be saved. Please try again.";
};

export default function GoalsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState("");

  const [createForm, setCreateForm] = useState({ name: "", targetAmount: "", targetDate: defaultTargetDate() });
  const [contributionAmount, setContributionAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [purchaseNote, setPurchaseNote] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferKind, setTransferKind] = useState<"AVAILABLE_MONEY" | "GOAL">("AVAILABLE_MONEY");
  const [destinationGoalId, setDestinationGoalId] = useState("");

  const refreshGoals = async () => {
    if (!userId) {
      setGoals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("goal_metrics")
      .select(
        "id, name, target_amount, target_date, current_balance, achievement_percentage, completion_percentage, status, completed_at, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError("Unable to load your goals right now.");
      setGoals([]);
      setLoading(false);
      return;
    }

    const loadedGoals = (data as GoalRow[]) ?? [];
    setGoals(loadedGoals);
    setSelectedGoalId((current) => {
      if (current && loadedGoals.some((goal) => goal.id === current)) return current;
      return loadedGoals[0]?.id ?? "";
    });
    setLoading(false);
    setError("");
  };

  useEffect(() => {
    void refreshGoals();
  }, [userId]);

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) ?? goals[0] ?? null,
    [goals, selectedGoalId],
  );

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status === "ACTIVE" || goal.status === "ACHIEVED"),
    [goals],
  );

  const completedGoals = useMemo(() => goals.filter((goal) => goal.status === "COMPLETED"), [goals]);

  useEffect(() => {
    if (transferKind === "GOAL" && activeGoals.length > 0 && !destinationGoalId) {
      const firstActive = activeGoals.find((goal) => goal.id !== selectedGoal?.id);
      setDestinationGoalId(firstActive?.id ?? "");
    }
  }, [transferKind, activeGoals, selectedGoal?.id, destinationGoalId]);

  const handleCreateGoal = async () => {
    if (!userId) return;

    const name = createForm.name.trim();
    const targetAmount = Number(createForm.targetAmount);

    if (!name) {
      setError("Give the goal a name.");
      return;
    }

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setError("Enter a valid target amount greater than zero.");
      return;
    }

    if (!createForm.targetDate) {
      setError("Choose a target date for the goal.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    const { error: insertError } = await supabase.from("savings_goals").insert({
      user_id: userId,
      name,
      target_amount: targetAmount,
      target_date: createForm.targetDate,
      saved_amount: 0,
      status: "ACTIVE",
    });

    if (insertError) {
      setError(getUserMessage(insertError.message));
      setSubmitting(false);
      return;
    }

    setCreateForm({ name: "", targetAmount: "", targetDate: defaultTargetDate() });
    setSuccess("Goal created successfully.");
    await refreshGoals();
    setSubmitting(false);
  };

  const handleContribution = async () => {
    if (!selectedGoal || !userId) return;
    if (selectedGoal.status === "COMPLETED") {
      setError("Completed goals are locked. Use a transfer or request a new goal instead.");
      return;
    }

    const amount = Number(contributionAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid contribution amount.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc("contribute_to_goal", {
      p_user_id: userId,
      p_goal_id: selectedGoal.id,
      p_amount: amount,
      p_description: "Goal contribution",
    });

    if (rpcError) {
      setError(getUserMessage(rpcError.message));
      setSubmitting(false);
      return;
    }

    setContributionAmount("");
    setSuccess("Contribution recorded.");
    await refreshGoals();
    setSubmitting(false);
  };

  const handleWithdrawal = async () => {
    if (!selectedGoal || !userId) return;
    if (selectedGoal.status === "COMPLETED") {
      setError("Completed goals cannot take new withdrawals unless they are being transferred.");
      return;
    }

    const amount = Number(withdrawAmount);
    const availableBalance = Number(selectedGoal.current_balance) || 0;

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid withdrawal amount.");
      return;
    }

    if (amount > availableBalance) {
      setError("Withdrawal amount exceeds the available goal balance.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc("withdraw_from_goal", {
      p_user_id: userId,
      p_goal_id: selectedGoal.id,
      p_amount: amount,
      p_description: "Goal withdrawal",
    });

    if (rpcError) {
      setError(getUserMessage(rpcError.message));
      setSubmitting(false);
      return;
    }

    setWithdrawAmount("");
    setSuccess("Withdrawal recorded.");
    await refreshGoals();
    setSubmitting(false);
  };

  const handlePurchase = async () => {
    if (!selectedGoal || !userId) return;
    if (selectedGoal.status === "COMPLETED") {
      setError("This goal is already completed and locked.");
      return;
    }

    const amount = Number(purchaseAmount);
    const availableBalance = Number(selectedGoal.current_balance) || 0;

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid purchase amount.");
      return;
    }

    if (amount > availableBalance) {
      setError("Purchase amount exceeds the available goal balance.");
      return;
    }

    Alert.alert(
      "Complete goal",
      `This will spend ${formatCurrency(amount)} from ${selectedGoal.name} and mark the goal as completed. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: async () => {
            setSubmitting(true);
            setError("");
            setSuccess("");

            const { error: rpcError } = await supabase.rpc("spend_from_goal", {
              p_user_id: userId,
              p_goal_id: selectedGoal.id,
              p_amount: amount,
              p_category: "Other",
              p_description: purchaseNote.trim() || "Goal purchase",
              p_occurred_at: new Date().toISOString(),
            });

            if (rpcError) {
              setError(getUserMessage(rpcError.message));
              setSubmitting(false);
              return;
            }

            setPurchaseAmount("");
            setPurchaseNote("");
            setSuccess("Goal completed and purchase recorded.");
            await refreshGoals();
            setSubmitting(false);
          },
        },
      ],
    );
  };

  const handleTransfer = async () => {
    if (!selectedGoal || !userId) return;
    if (selectedGoal.status !== "COMPLETED") {
      setError("Transfer remaining balance is only available for completed goals.");
      return;
    }

    const amount = Number(transferAmount);
    const availableBalance = Number(selectedGoal.current_balance) || 0;

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid transfer amount.");
      return;
    }

    if (amount > availableBalance) {
      setError("Transfer amount exceeds the remaining goal balance.");
      return;
    }

    if (transferKind === "GOAL") {
      const targetGoal = activeGoals.find((goal) => goal.id === destinationGoalId && goal.id !== selectedGoal.id);
      if (!targetGoal) {
        setError("Choose another active goal to receive the transfer.");
        return;
      }
    }

    const confirmText =
      transferKind === "AVAILABLE_MONEY"
        ? `Transfer ${formatCurrency(amount)} from ${selectedGoal.name} to available money?`
        : `Transfer ${formatCurrency(amount)} from ${selectedGoal.name} to ${activeGoals.find((goal) => goal.id === destinationGoalId)?.name ?? "another goal"}?`;

    Alert.alert("Transfer remaining balance", confirmText, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        style: "destructive",
        onPress: async () => {
          setSubmitting(true);
          setError("");
          setSuccess("");

          try {
            if (transferKind === "AVAILABLE_MONEY") {
              const { error: rpcError } = await supabase.rpc("transfer_completed_goal_to_available_money", {
                p_user_id: userId,
                p_goal_id: selectedGoal.id,
                p_amount: amount,
                p_description: "Transferred remaining goal balance to available money",
                p_occurred_at: new Date().toISOString(),
              });

              if (rpcError) throw rpcError;
            } else {
              const { error: rpcError } = await supabase.rpc("transfer_completed_goal_to_goal", {
                p_user_id: userId,
                p_source_goal_id: selectedGoal.id,
                p_destination_goal_id: destinationGoalId,
                p_amount: amount,
                p_description: "Transferred remaining goal balance to another goal",
                p_occurred_at: new Date().toISOString(),
              });

              if (rpcError) throw rpcError;
            }

            setTransferAmount("");
            setSuccess("Remaining balance transferred successfully.");
            await refreshGoals();
          } catch (rpcError: any) {
            setError(getUserMessage(rpcError?.message));
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Goals</Text>

        {error ? <Text style={styles.alertError}>{error}</Text> : null}
        {success ? <Text style={styles.alertSuccess}>{success}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Create goal</Text>
          <TextInput
            value={createForm.name}
            onChangeText={(value) => setCreateForm((current) => ({ ...current, name: value }))}
            placeholder="Goal name"
            style={styles.input}
          />
          <TextInput
            value={createForm.targetAmount}
            onChangeText={(value) => setCreateForm((current) => ({ ...current, targetAmount: value }))}
            placeholder="Target amount"
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <TextInput
            value={createForm.targetDate}
            onChangeText={(value) => setCreateForm((current) => ({ ...current, targetDate: value }))}
            placeholder="Target date"
            style={styles.input}
          />
          <TouchableOpacity style={[styles.primaryButton, submitting && styles.disabledButton]} onPress={handleCreateGoal} disabled={submitting}>
            <Text style={styles.primaryButtonText}>{submitting ? "Saving..." : "Create goal"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Goal actions</Text>

          {loading ? (
            <View style={styles.centeredRow}><ActivityIndicator color="#10B981" /></View>
          ) : goals.length === 0 ? (
            <Text style={styles.emptyText}>No goals yet. Create your first goal above.</Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalChipsContainer}>
                {goals.map((goal) => (
                  <TouchableOpacity
                    key={goal.id}
                    onPress={() => setSelectedGoalId(goal.id)}
                    style={[styles.goalChip, selectedGoal?.id === goal.id && styles.goalChipActive]}
                  >
                    <Text style={[styles.goalChipText, selectedGoal?.id === goal.id && styles.goalChipTextActive]}>{goal.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedGoal && (
                <View style={styles.metricsBox}>
                  <View style={styles.metricRowBetween}>
                    <Text style={styles.label}>Status</Text>
                    <Text style={styles.statusPill}>{selectedGoal.status}</Text>
                  </View>
                  <Text style={styles.metricValue}>Target: {formatCurrency(Number(selectedGoal.target_amount))}</Text>
                  <Text style={styles.metricValue}>Current balance: {formatCurrency(Number(selectedGoal.current_balance))}</Text>
                  <Text style={styles.metricValue}>Achievement: {Number(selectedGoal.achievement_percentage).toFixed(2)}%</Text>
                  <Text style={styles.metricValue}>Completion: {Number(selectedGoal.completion_percentage).toFixed(0)}%</Text>
                  {selectedGoal.target_date ? <Text style={styles.smallText}>Target date: {new Date(selectedGoal.target_date).toLocaleDateString()}</Text> : null}
                  {selectedGoal.status === "COMPLETED" ? <Text style={styles.lockedText}>Completed goal: locked for further edits.</Text> : null}
                </View>
              )}

              <View style={styles.formBlock}>
                <Text style={styles.label}>Contribute</Text>
                <TextInput
                  value={contributionAmount}
                  onChangeText={setContributionAmount}
                  placeholder="Amount"
                  keyboardType="decimal-pad"
                  style={styles.input}
                  editable={selectedGoal?.status !== "COMPLETED"}
                />
                <TouchableOpacity
                  style={[styles.secondaryButton, (submitting || selectedGoal?.status === "COMPLETED") && styles.disabledButton]}
                  onPress={handleContribution}
                  disabled={submitting || selectedGoal?.status === "COMPLETED"}
                >
                  <Text style={styles.secondaryButtonText}>Contribute</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formBlock}>
                <Text style={styles.label}>Withdraw</Text>
                <TextInput
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                  placeholder="Amount"
                  keyboardType="decimal-pad"
                  style={styles.input}
                  editable={selectedGoal?.status !== "COMPLETED"}
                />
                <TouchableOpacity
                  style={[styles.secondaryButton, (submitting || selectedGoal?.status === "COMPLETED") && styles.disabledButton]}
                  onPress={handleWithdrawal}
                  disabled={submitting || selectedGoal?.status === "COMPLETED"}
                >
                  <Text style={styles.secondaryButtonText}>Withdraw</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formBlock}>
                <Text style={styles.label}>Purchase / complete goal</Text>
                <TextInput
                  value={purchaseAmount}
                  onChangeText={setPurchaseAmount}
                  placeholder="Amount"
                  keyboardType="decimal-pad"
                  style={styles.input}
                  editable={selectedGoal?.status !== "COMPLETED"}
                />
                <TextInput
                  value={purchaseNote}
                  onChangeText={setPurchaseNote}
                  placeholder="Description"
                  style={styles.input}
                  editable={selectedGoal?.status !== "COMPLETED"}
                />
                <TouchableOpacity
                  style={[styles.secondaryButton, (submitting || selectedGoal?.status === "COMPLETED") && styles.disabledButton]}
                  onPress={handlePurchase}
                  disabled={submitting || selectedGoal?.status === "COMPLETED"}
                >
                  <Text style={styles.secondaryButtonText}>Complete goal</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {completedGoals.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Transfer remaining balance</Text>
            <TextInput
              value={transferAmount}
              onChangeText={setTransferAmount}
              placeholder="Transfer amount"
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <Text style={styles.label}>Destination</Text>
            <View style={styles.choiceRow}>
              <TouchableOpacity
                style={[styles.choiceButton, transferKind === "AVAILABLE_MONEY" && styles.choiceButtonActive]}
                onPress={() => setTransferKind("AVAILABLE_MONEY")}
              >
                <Text style={[styles.choiceButtonText, transferKind === "AVAILABLE_MONEY" && styles.choiceButtonTextActive]}>Available money</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choiceButton, transferKind === "GOAL" && styles.choiceButtonActive]}
                onPress={() => setTransferKind("GOAL")}
              >
                <Text style={[styles.choiceButtonText, transferKind === "GOAL" && styles.choiceButtonTextActive]}>Another goal</Text>
              </TouchableOpacity>
            </View>

            {transferKind === "GOAL" && (
              <>
                <Text style={styles.label}>Destination goal</Text>
                <View style={styles.pickerBox}>
                  {activeGoals
                    .filter((goal) => goal.id !== selectedGoal?.id)
                    .map((goal) => (
                      <TouchableOpacity
                        key={goal.id}
                        style={[styles.goalOption, destinationGoalId === goal.id && styles.goalOptionSelected]}
                        onPress={() => setDestinationGoalId(goal.id)}
                      >
                        <Text style={[styles.goalOptionText, destinationGoalId === goal.id && styles.goalOptionTextSelected]}>{goal.name}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, submitting && styles.disabledButton]}
              onPress={handleTransfer}
              disabled={submitting}
            >
              <Text style={styles.primaryButtonText}>Transfer</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F8FA" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: "700", color: "#17212B", marginBottom: 16 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#17212B", marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "700", color: "#475467", marginBottom: 8, textTransform: "uppercase" },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
    color: "#17212B",
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    backgroundColor: "#E0F2FE",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: "#0F172A", fontSize: 15, fontWeight: "700" },
  centeredRow: { paddingVertical: 12, alignItems: "center" },
  emptyText: { color: "#667085", fontSize: 14 },
  alertError: { backgroundColor: "#FEF2F2", color: "#991B1B", borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 13 },
  alertSuccess: { backgroundColor: "#ECFDF5", color: "#047857", borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 13 },
  goalChipsContainer: { paddingBottom: 8 },
  goalChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  goalChipActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  goalChipText: { color: "#17212B", fontWeight: "600" },
  goalChipTextActive: { color: "#FFFFFF" },
  metricsBox: { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, marginTop: 12 },
  metricRowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  metricValue: { color: "#17212B", fontSize: 14, marginTop: 6, fontWeight: "600" },
  smallText: { color: "#475467", fontSize: 12, marginTop: 8 },
  statusPill: {
    backgroundColor: "#D1FAE5",
    color: "#047857",
    borderRadius: 999,
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  lockedText: { color: "#B91C1C", fontSize: 12, fontWeight: "600", marginTop: 8 },
  formBlock: { marginTop: 16 },
  choiceRow: { flexDirection: "row", marginBottom: 8 },
  choiceButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    paddingVertical: 10,
    marginRight: 8,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  choiceButtonActive: { backgroundColor: "#D1FAE5", borderColor: "#10B981" },
  choiceButtonText: { color: "#17212B", fontWeight: "600" },
  choiceButtonTextActive: { color: "#047857" },
  pickerBox: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  goalOption: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  goalOptionSelected: { backgroundColor: "#D1FAE5", borderColor: "#10B981" },
  goalOptionText: { color: "#17212B", fontWeight: "600" },
  goalOptionTextSelected: { color: "#047857" },
  disabledButton: { opacity: 0.55 },
});