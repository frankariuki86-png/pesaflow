import { View, ScrollView, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";

export default function ReportsScreen() {
  const [selectedTab, setSelectedTab] = useState("personal");
  const [selectedPeriod, setSelectedPeriod] = useState("month");

  const mockData = {
    personal: {
      totalIncome: 53500,
      totalExpense: 24300,
      netSavings: 29200,
      savingsRate: 54.5,
      categories: [
        { name: "Food", amount: 8500, percentage: 35 },
        { name: "Transport", amount: 4200, percentage: 17 },
        { name: "Entertainment", amount: 3100, percentage: 13 },
        { name: "Utilities", amount: 4100, percentage: 17 },
        { name: "Savings", amount: 4300, percentage: 18 },
      ]
    },
    business: {
      totalSales: 286000,
      totalExpense: 78500,
      netProfit: 207500,
      profitMargin: 72.5,
      categories: [
        { name: "Sales", amount: 286000, percentage: 100 },
        { name: "Rent", amount: 35000, percentage: 45 },
        { name: "Staff", amount: 31500, percentage: 40 },
        { name: "Supplies", amount: 12000, percentage: 15 },
      ]
    },
    chama: {
      totalContributions: 57500,
      totalLoans: 80000,
      welfareSupport: 15000,
      loanRepayment: 12000,
      categories: [
        { name: "Contributions", amount: 57500, percentage: 45 },
        { name: "Loans Received", amount: 80000, percentage: 55 },
      ]
    },
    insights: [
      { title: "Save More in Utilities", description: "Your utilities spending increased by 15% this month. Consider reviewing subscriptions.", icon: "flash", color: "#F59E0B" },
      { title: "Great Savings Rate", description: "You've saved 54.5% of your income this month - that's above average!", icon: "trending-up", color: "#10B981" },
      { title: "Chama Performing Well", description: "Your Chama fund grew by KES 12,000 this month. Keep up the contributions!", icon: "account-group", color: "#3B82F6" },
      { title: "Business Growth", description: "Business profit increased 18% compared to last month. Excellent performance!", icon: "briefcase", color: "#8B5CF6" },
    ]
  };

  const currentData = selectedTab === "personal" ? mockData.personal : selectedTab === "business" ? mockData.business : mockData.chama;
  const summaryLabel = selectedTab === "personal" ? "Net Savings" : selectedTab === "business" ? "Net Profit" : "Total Contributions";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.pageTitle}>Reports</Text>

        {/* Report Type Tabs */}
        <View style={styles.tabsRow}>
          {["personal", "business", "chama"].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, selectedTab === tab && styles.tabActive]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Period Selector */}
        <View style={styles.periodRow}>
          {["week", "month", "quarter", "year"].map(period => (
            <TouchableOpacity
              key={period}
              style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text style={[styles.periodText, selectedPeriod === period && styles.periodTextActive]}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { borderLeftColor: "#10B981" }]}>
            <Text style={styles.metricCardLabel}>Income</Text>
            <Text style={styles.metricCardValue}>KES {((selectedTab === "personal" || selectedTab === "business" ? (currentData as any).totalIncome || (currentData as any).totalSales : 0) / 1000).toFixed(1)}K</Text>
          </View>
          <View style={[styles.metricCard, { borderLeftColor: "#EF4444" }]}>
            <Text style={styles.metricCardLabel}>Expenses</Text>
            <Text style={styles.metricCardValue}>KES {((currentData as any).totalExpense / 1000).toFixed(1)}K</Text>
          </View>
          <View style={[styles.metricCard, { borderLeftColor: "#3B82F6" }]}>
            <Text style={styles.metricCardLabel}>{summaryLabel}</Text>
            <Text style={styles.metricCardValue}>
              KES {((selectedTab === "personal" ? (currentData as any).netSavings : selectedTab === "business" ? (currentData as any).netProfit : (currentData as any).totalContributions) / 1000).toFixed(1)}K
            </Text>
          </View>
          <View style={[styles.metricCard, { borderLeftColor: "#8B5CF6" }]}>
            <Text style={styles.metricCardLabel}>Rate</Text>
            <Text style={styles.metricCardValue}>
              {selectedTab === "personal" ? mockData.personal.savingsRate : selectedTab === "business" ? mockData.business.profitMargin : 100}%
            </Text>
          </View>
        </View>

        {/* Category Breakdown */}
        <Text style={styles.sectionTitle}>Breakdown by Category</Text>
        {currentData.categories.map((category, index) => (
          <View key={index} style={styles.categoryItem}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryAmount}>KES {(category.amount / 1000).toFixed(1)}K</Text>
            </View>
            <View style={styles.categoryBarContainer}>
              <View style={[styles.categoryBar, { width: `${category.percentage}%` }]} />
            </View>
            <Text style={styles.categoryPercent}>{category.percentage}% of total</Text>
          </View>
        ))}

        {/* AI Insights */}
        <Text style={styles.sectionTitle}>Insights & Recommendations</Text>
        {mockData.insights.map((insight, index) => (
          <View key={index} style={styles.insightCard}>
            <View style={[styles.insightIcon, { backgroundColor: `${insight.color}20` }]}>
              <MaterialCommunityIcons name={insight.icon as any} color={insight.color} size={20} />
            </View>
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightDescription}>{insight.description}</Text>
            </View>
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
  tabsRow: { flexDirection: "row", marginBottom: 16 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  tabActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  tabText: { fontSize: 12, fontWeight: "600", color: "#667085", textAlign: "center" },
  tabTextActive: { color: "white" },
  periodRow: { flexDirection: "row", marginBottom: 20 },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  periodButtonActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  periodText: { fontSize: 12, fontWeight: "600", color: "#667085" },
  periodTextActive: { color: "white" },
  metricsGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20
  },
  metricCard: {
    width: "48%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  },
  metricCardLabel: { fontSize: 12, color: "#667085", marginBottom: 4 },
  metricCardValue: { fontSize: 18, fontWeight: "700", color: "#17212B" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#17212B", marginBottom: 12, marginTop: 20 },
  categoryItem: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  categoryHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  categoryName: { fontSize: 14, fontWeight: "600", color: "#17212B" },
  categoryAmount: { fontSize: 14, fontWeight: "700", color: "#17212B" },
  categoryBarContainer: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  categoryBar: { height: "100%", backgroundColor: "#10B981", borderRadius: 4 },
  categoryPercent: { fontSize: 12, color: "#667085" },
  insightCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "flex-start"
  },
  insightIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 12 },
  insightContent: { flex: 1 },
  insightTitle: { fontSize: 14, fontWeight: "700", color: "#17212B", marginBottom: 4 },
  insightDescription: { fontSize: 12, color: "#667085", lineHeight: 18 },
});
