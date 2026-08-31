import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../services/supabase";

type Direction = "INCOME" | "EXPENSE";
type Category = { id: string; name: string; kind: Direction };
type SourceLabel = "M-Pesa" | "Cash" | "Bank" | "Other";
type Transaction = {
  id: string;
  description: string | null;
  category: string;
  amount: number;
  direction: Direction;
  source: string;
  occurred_at: string;
};

const defaultExpenseCategories = [
  "Food",
  "Transport",
  "Rent",
  "Utilities",
  "Airtime",
  "Internet",
  "Shopping",
  "Entertainment",
  "Education",
  "Medical",
  "Family",
  "Loans",
  "Savings",
  "Business",
  "Other",
  "Uncategorized",
];

const defaultIncomeCategories = [
  "Salary",
  "Business",
  "Freelance",
  "Gift",
  "Transfer",
  "Other Income",
  "Uncategorized",
];

const sourceOptions: SourceLabel[] = ["M-Pesa", "Cash", "Bank", "Other"];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2,
  }).format(amount || 0);

const toDbSource = (source: SourceLabel) => {
  switch (source) {
    case "M-Pesa":
      return "MPESA";
    case "Cash":
      return "MANUAL";
    case "Bank":
      return "BANK";
    case "Other":
      return "IMPORT";
    default:
      return "MANUAL";
  }
};

export default function MoneyScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [direction, setDirection] = useState<Direction>("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [source, setSource] = useState<SourceLabel>("Cash");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<"ALL" | Direction>("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [categoryModal, setCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<Direction>("EXPENSE");

  const loadData = async () => {
    if (!userId) return;

    setLoading(true);

    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select("id, name, kind")
      .eq("user_id", userId)
      .order("name");

    if (categoryError) {
      setError("Unable to load categories.");
      setLoading(false);
      return;
    }

    let loadedCategories = (categoryData as Category[]) ?? [];
    if (loadedCategories.length === 0) {
      const defaults = [
        ...defaultExpenseCategories.map((name) => ({ user_id: userId, name, kind: "EXPENSE" })),
        ...defaultIncomeCategories.map((name) => ({ user_id: userId, name, kind: "INCOME" })),
      ];

      const { data: seededData, error: seedError } = await supabase
        .from("categories")
        .upsert(defaults, { onConflict: "user_id,name,kind" })
        .select("id, name, kind");

      if (seedError) {
        setError("Unable to set up default categories.");
        setLoading(false);
        return;
      }

      loadedCategories = (seededData as Category[]) ?? [];
    }

    const { data: transactionData, error: transactionError } = await supabase
      .from("transactions")
      .select("id, description, category, amount, direction, source, occurred_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .limit(50);

    if (transactionError) {
      setError("Unable to load transactions.");
      setLoading(false);
      return;
    }

    setCategories(loadedCategories);
    setTransactions((transactionData as Transaction[]) ?? []);

    const preferredCategory =
      loadedCategories.find((item) => item.kind === direction && item.name === "Uncategorized") ||
      loadedCategories.find((item) => item.kind === direction) ||
      loadedCategories[0];

    if (preferredCategory) {
      setCategoryId(preferredCategory.id);
    }

    setError("");
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [userId]);

  const visibleCategories = categories.filter((item) => item.kind === direction);
  const filteredTransactions = filter === "ALL" ? transactions : transactions.filter((item) => item.direction === filter);
  const totals = useMemo(
    () => ({
      income: transactions.filter((item) => item.direction === "INCOME").reduce((sum, item) => sum + Number(item.amount), 0),
      expense: transactions.filter((item) => item.direction === "EXPENSE").reduce((sum, item) => sum + Number(item.amount), 0),
    }),
    [transactions],
  );

  const changeDirection = (nextDirection: Direction) => {
    setDirection(nextDirection);
    const nextCategory =
      categories.find((item) => item.kind === nextDirection && item.name === "Uncategorized") ||
      categories.find((item) => item.kind === nextDirection);

    if (nextCategory) {
      setCategoryId(nextCategory.id);
    }
  };

  const saveTransaction = async () => {
    if (!userId) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Please enter a valid amount.");
      setSaving(false);
      return;
    }

    const selectedCategory = categories.find((item) => item.id === categoryId);
    if (!selectedCategory) {
      setError("Please select a category.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("transactions").insert({
      user_id: userId,
      category: selectedCategory.name,
      amount: numericAmount,
      direction,
      source: toDbSource(source),
      description: description.trim() || null,
      account_name: source === "Cash" ? "Cash" : source,
      occurred_at: new Date().toISOString(),
    });

    if (insertError) {
      setError(insertError.message || "Unable to save the transaction.");
      setSaving(false);
      return;
    }

    setAmount("");
    setDescription("");
    setSuccess("Transaction added successfully.");
    await loadData();
    setSaving(false);
  };

  const saveCategory = async () => {
    if (!userId || !newCategory.trim()) {
      setError("Please enter a category name.");
      return;
    }

    setSaving(true);
    setError("");

    const { data, error: insertError } = await supabase
      .from("categories")
      .insert({ user_id: userId, name: newCategory.trim(), kind: newCategoryType })
      .select("id, name, kind")
      .single();

    if (insertError) {
      setError(insertError.code === "23505" ? "That category already exists." : "Unable to save the category.");
      setSaving(false);
      return;
    }

    const created = data as Category;
    setCategories((current) => [...current, created]);
    setCategoryId(created.id);
    setDirection(created.kind);
    setNewCategory("");
    setCategoryModal(false);
    setSaving(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Money</Text>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: "#10B981" }]}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.income)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: "#EF4444" }]}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.expense)}</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Add transaction</Text>

          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.optionRow}>
            {(["EXPENSE", "INCOME"] as Direction[]).map((item) => (
              <TouchableOpacity key={item} style={[styles.option, direction === item && styles.optionActive]} onPress={() => changeDirection(item)}>
                <Text style={[styles.optionText, direction === item && styles.optionTextActive]}>{item === "INCOME" ? "Income" : "Expense"}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.pickerWrap}>
            {visibleCategories.map((item) => (
              <TouchableOpacity key={item.id} style={[styles.chip, categoryId === item.id && styles.chipActive]} onPress={() => setCategoryId(item.id)}>
                <Text style={[styles.chipText, categoryId === item.id && styles.chipTextActive]}>{item.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addChip} onPress={() => { setNewCategoryType(direction); setCategoryModal(true); }}>
              <Text style={styles.addChipText}>+ Add Category</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Amount</Text>
          <View style={styles.amountWrap}>
            <Text style={styles.amountPrefix}>KES</Text>
            <TextInput value={amount} onChangeText={setAmount} placeholder="500.00" keyboardType="decimal-pad" style={styles.input} />
          </View>

          <Text style={styles.fieldLabel}>Description (optional)</Text>
          <TextInput value={description} onChangeText={setDescription} placeholder="Lunch" style={styles.input} />

          <Text style={styles.fieldLabel}>Source</Text>
          <View style={styles.pickerWrap}>
            {sourceOptions.map((item) => (
              <TouchableOpacity key={item} style={[styles.chip, source === item && styles.chipActive]} onPress={() => setSource(item)}>
                <Text style={[styles.chipText, source === item && styles.chipTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}

          <TouchableOpacity onPress={saveTransaction} disabled={saving || loading} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Transactions</Text>
        <View style={styles.optionRow}>
          {(["ALL", "INCOME", "EXPENSE"] as const).map((item) => (
            <TouchableOpacity key={item} style={[styles.option, filter === item && styles.optionActive]} onPress={() => setFilter(item)}>
              <Text style={[styles.optionText, filter === item && styles.optionTextActive]}>{item === "ALL" ? "All" : item === "INCOME" ? "Income" : "Expense"}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color="#10B981" />
        ) : filteredTransactions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No transactions yet. Add your first transaction.</Text>
          </View>
        ) : (
          filteredTransactions.map((item) => (
            <View key={item.id} style={styles.transaction}>
              <View style={[styles.txIcon, { backgroundColor: item.direction === "INCOME" ? "#E0F9F0" : "#FEE2E2" }]}>
                <Text style={{ color: item.direction === "INCOME" ? "#10B981" : "#EF4444", fontSize: 18 }}>
                  {item.direction === "INCOME" ? "+" : "-"}
                </Text>
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txName}>{item.category}</Text>
                <Text style={styles.txMeta}>{item.description || "No description"} • {item.source} • {new Date(item.occurred_at).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.txValue, { color: item.direction === "INCOME" ? "#10B981" : "#EF4444" }]}>
                {item.direction === "INCOME" ? "+" : "-"}
                {formatCurrency(Number(item.amount))}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={categoryModal} transparent animationType="slide" onRequestClose={() => setCategoryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.sectionTitle}>Add Category</Text>
            <TextInput value={newCategory} onChangeText={setNewCategory} placeholder="Category name" style={styles.input} autoFocus />
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.optionRow}>
              {(["INCOME", "EXPENSE"] as Direction[]).map((item) => (
                <TouchableOpacity key={item} style={[styles.option, newCategoryType === item && styles.optionActive]} onPress={() => setNewCategoryType(item)}>
                  <Text style={[styles.optionText, newCategoryType === item && styles.optionTextActive]}>{item === "INCOME" ? "Income" : "Expense"}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setCategoryModal(false)} style={styles.cancelButton}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveCategory} disabled={saving} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Category"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F8FA" },
  content: { padding: 16, paddingTop: 24, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontWeight: "700", color: "#17212B", marginBottom: 18 },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 18 },
  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryLabel: { color: "#667085", fontSize: 12 },
  summaryValue: { color: "#17212B", fontSize: 17, fontWeight: "700", marginTop: 6 },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#17212B", marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#17212B", marginTop: 12, marginBottom: 8 },
  optionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  option: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  optionActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  optionText: { color: "#667085", fontWeight: "600" },
  optionTextActive: { color: "#FFFFFF" },
  pickerWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: "#ECFDF5", borderColor: "#10B981" },
  chipText: { color: "#667085", fontSize: 12 },
  chipTextActive: { color: "#047857", fontWeight: "700" },
  addChip: { borderWidth: 1, borderColor: "#0EA5E9", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  addChipText: { color: "#0284C7", fontSize: 12, fontWeight: "700" },
  amountWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 11, paddingHorizontal: 10 },
  amountPrefix: { fontSize: 14, fontWeight: "700", color: "#667085", marginRight: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 11, padding: 13, color: "#17212B", marginTop: 4 },
  saveButton: { backgroundColor: "#10B981", borderRadius: 11, paddingVertical: 12, alignItems: "center", marginTop: 18 },
  saveButtonText: { color: "#FFFFFF", fontWeight: "700" },
  error: { color: "#B91C1C", fontSize: 12, marginTop: 12 },
  success: { color: "#047857", fontSize: 12, marginTop: 12 },
  empty: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 18, marginTop: 12 },
  emptyText: { color: "#667085" },
  transaction: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, marginTop: 12 },
  txIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  txDetails: { flex: 1, marginLeft: 12 },
  txName: { color: "#17212B", fontWeight: "700" },
  txMeta: { color: "#667085", fontSize: 12, marginTop: 3 },
  txValue: { fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.5)", justifyContent: "center", padding: 20 },
  modal: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 20, gap: 12 },
  cancelButton: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 11, paddingVertical: 10, paddingHorizontal: 14 },
});
