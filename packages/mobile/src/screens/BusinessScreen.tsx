import { View, ScrollView, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function BusinessScreen() {
  const mockData = {
    today: {
      sales: 45000,
      expenses: 12300,
      profit: 32700,
      margin: 72.7
    },
    weekPerformance: [
      { day: "Mon", sales: 38000, expenses: 9500, profit: 28500 },
      { day: "Tue", sales: 42000, expenses: 11200, profit: 30800 },
      { day: "Wed", sales: 45000, expenses: 12300, profit: 32700 },
      { day: "Thu", sales: 41000, expenses: 10800, profit: 30200 },
      { day: "Fri", sales: 52000, expenses: 13500, profit: 38500 },
      { day: "Sat", sales: 68000, expenses: 15200, profit: 52800 },
      { day: "Sun", sales: 35000, expenses: 8900, profit: 26100 },
    ],
    inventory: [
      { id: 1, name: "Rice (50kg)", quantity: 12, minLevel: 5, status: "good" },
      { id: 2, name: "Beans (20kg)", quantity: 3, minLevel: 8, status: "low" },
      { id: 3, name: "Flour (10kg)", quantity: 25, minLevel: 10, status: "good" },
      { id: 4, name: "Sugar (2kg)", quantity: 2, minLevel: 5, status: "critical" },
    ],
    expenses: [
      { id: 1, category: "Rent", amount: 5000, percentage: 41 },
      { id: 2, category: "Staff", amount: 4500, percentage: 37 },
      { id: 3, category: "Utilities", amount: 1800, percentage: 15 },
      { id: 4, category: "Supplies", amount: 800, percentage: 7 },
    ]
  };

  const getStatusColor = (status) => {
    switch(status) {
      case "good": return "#10B981";
      case "low": return "#F59E0B";
      case "critical": return "#EF4444";
      default: return "#667085";
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.pageTitle}>Business</Text>

        {/* Today's Summary */}
        <View style={styles.todayCard}>
          <Text style={styles.todayLabel}>Today's Performance</Text>
          <View style={styles.todayMetrics}>
            <View style={styles.metricBox}>
              <MaterialCommunityIcons name="cash-multiple" color="#10B981" size={24} />
              <Text style={styles.metricLabel}>Sales</Text>
              <Text style={styles.metricValue}>KES {(mockData.today.sales / 1000).toFixed(0)}K</Text>
            </View>
            <View style={styles.metricBox}>
              <MaterialCommunityIcons name="trending-down" color="#EF4444" size={24} />
              <Text style={styles.metricLabel}>Expenses</Text>
              <Text style={styles.metricValue}>KES {(mockData.today.expenses / 1000).toFixed(1)}K</Text>
            </View>
            <View style={styles.metricBox}>
              <MaterialCommunityIcons name="chart-line" color="#3B82F6" size={24} />
              <Text style={styles.metricLabel}>Profit</Text>
              <Text style={styles.metricValue}>KES {(mockData.today.profit / 1000).toFixed(1)}K</Text>
            </View>
          </View>
          <View style={styles.marginBox}>
            <Text style={styles.marginLabel}>Profit Margin</Text>
            <Text style={styles.marginValue}>{mockData.today.margin}%</Text>
          </View>
        </View>

        {/* Weekly Performance */}
        <Text style={styles.sectionTitle}>Weekly Performance</Text>
        <View style={styles.weeklyChart}>
          {mockData.weekPerformance.map((day, index) => (
            <View key={index} style={styles.barContainer}>
              <View style={[styles.bar, { height: `${(day.sales / 70000) * 100}%` }]} />
              <Text style={styles.dayLabel}>{day.day}</Text>
            </View>
          ))}
        </View>

        {/* Inventory Status */}
        <Text style={styles.sectionTitle}>Inventory Status</Text>
        {mockData.inventory.map(item => (
          <View key={item.id} style={styles.inventoryItem}>
            <View style={styles.inventoryInfo}>
              <Text style={styles.inventoryName}>{item.name}</Text>
              <Text style={styles.inventoryQuantity}>
                Qty: {item.quantity} | Min: {item.minLevel}
              </Text>
            </View>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusLabel}>
                {item.status === "good" ? "Good" : item.status === "low" ? "Low" : "Critical"}
              </Text>
            </View>
          </View>
        ))}

        {/* Monthly Expenses Breakdown */}
        <Text style={styles.sectionTitle}>Monthly Expenses</Text>
        {mockData.expenses.map(expense => (
          <View key={expense.id} style={styles.expenseItem}>
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseCategory}>{expense.category}</Text>
              <Text style={styles.expenseAmount}>KES {expense.amount.toLocaleString('en-KE')}</Text>
            </View>
            <View style={styles.expenseBar}>
              <View style={[styles.expenseBarFill, { width: `${expense.percentage}%` }]} />
            </View>
            <Text style={styles.expensePercent}>{expense.percentage}%</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F8FA" },
  content: { padding: 16, paddingTop: 20, paddingBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: "700", color: "#17212B", marginBottom: 20 },
  todayCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3
  },
  todayLabel: { fontSize: 14, color: "#667085", marginBottom: 16 },
  todayMetrics: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  metricBox: { alignItems: "center", flex: 1 },
  metricLabel: { fontSize: 11, color: "#667085", marginTop: 6, marginBottom: 2 },
  metricValue: { fontSize: 16, fontWeight: "700", color: "#17212B" },
  marginBox: { backgroundColor: "#F3F4F6", borderRadius: 12, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  marginLabel: { fontSize: 13, color: "#667085" },
  marginValue: { fontSize: 24, fontWeight: "700", color: "#10B981" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#17212B", marginBottom: 12, marginTop: 20 },
  weeklyChart: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end", height: 150, backgroundColor: "white", borderRadius: 12, padding: 16, marginBottom: 20 },
  barContainer: { flex: 1, alignItems: "center", justifyContent: "flex-end", marginHorizontal: 4, height: "100%" },
  bar: { width: "100%", backgroundColor: "#10B981", borderRadius: 4, marginBottom: 8 },
  dayLabel: { fontSize: 11, color: "#667085" },
  inventoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12
  },
  inventoryInfo: { flex: 1 },
  inventoryName: { fontSize: 14, fontWeight: "600", color: "#17212B", marginBottom: 4 },
  inventoryQuantity: { fontSize: 12, color: "#667085" },
  statusIndicator: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusLabel: { fontSize: 11, fontWeight: "600", color: "white" },
  expenseItem: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12
  },
  expenseInfo: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  expenseCategory: { fontSize: 14, fontWeight: "600", color: "#17212B" },
  expenseAmount: { fontSize: 14, fontWeight: "700", color: "#17212B" },
  expenseBar: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden", marginBottom: 6 },
  expenseBarFill: { height: "100%", backgroundColor: "#8B5CF6", borderRadius: 4 },
  expensePercent: { fontSize: 12, color: "#667085", textAlign: "right" },
});
