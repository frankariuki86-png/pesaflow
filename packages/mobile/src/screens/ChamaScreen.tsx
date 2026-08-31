import { View, ScrollView, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function ChamaScreen() {
  const mockData = {
    groups: [
      {
        id: 1,
        name: "Nairobi Investors Club",
        members: 12,
        fund: 450000,
        myContribution: 35000,
        nextMeeting: "Sept 3",
        color: "#10B981"
      },
      {
        id: 2,
        name: "Women's Savings Group",
        members: 8,
        fund: 180000,
        myContribution: 22500,
        nextMeeting: "Sept 1",
        color: "#EC4899"
      },
    ],
    loans: [
      { id: 1, amount: 50000, status: "active", borrowed: "15 days ago", repaidAmount: 10000 },
      { id: 2, amount: 30000, status: "pending", borrowed: "2 days ago", repaidAmount: 0 },
    ],
    welfare: [
      { id: 1, type: "Medical", member: "Jane Mwangi", amount: 15000, status: "approved", date: "Aug 20" },
      { id: 2, type: "Funeral", member: "John Omondi", amount: 25000, status: "pending", date: "Aug 24" },
    ]
  };

  const statusColors = {
    active: "#10B981",
    pending: "#F59E0B",
    approved: "#3B82F6"
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.pageTitle}>Chama</Text>

        {/* Groups Section */}
        <Text style={styles.sectionTitle}>Your Groups</Text>
        {mockData.groups.map(group => (
          <View key={group.id} style={styles.groupCard}>
            <View style={[styles.groupIcon, { backgroundColor: `${group.color}20` }]}>
              <MaterialCommunityIcons name="account-group" color={group.color} size={24} />
            </View>
            <View style={styles.groupInfo}>
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={styles.groupMembers}>{group.members} members • Fund: KES {(group.fund / 1000).toFixed(0)}K</Text>
            </View>
            <TouchableOpacity style={styles.groupAction}>
              <MaterialCommunityIcons name="chevron-right" color="#10B981" size={24} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="cash" color="#10B981" size={20} />
            <Text style={styles.statValue}>KES 57.5K</Text>
            <Text style={styles.statLabel}>My Total Contributions</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="handshake" color="#3B82F6" size={20} />
            <Text style={styles.statValue}>2</Text>
            <Text style={styles.statLabel}>Active Loans</Text>
          </View>
        </View>

        {/* Loans Section */}
        <Text style={styles.sectionTitle}>Loans</Text>
        {mockData.loans.map(loan => {
          const repaymentPercent = (loan.repaidAmount / loan.amount) * 100;
          return (
            <View key={loan.id} style={styles.loanItem}>
              <View style={styles.loanHeader}>
                <View>
                  <Text style={styles.loanAmount}>KES {loan.amount.toLocaleString('en-KE')}</Text>
                  <Text style={styles.loanDate}>Borrowed {loan.borrowed}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColors[loan.status]}20` }]}>
                  <Text style={[styles.statusText, { color: statusColors[loan.status] }]}>
                    {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                  </Text>
                </View>
              </View>
              {loan.status === "active" && (
                <>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${repaymentPercent}%` }]} />
                  </View>
                  <Text style={styles.repaymentText}>
                    Repaid: KES {loan.repaidAmount.toLocaleString('en-KE')} of KES {loan.amount.toLocaleString('en-KE')}
                  </Text>
                </>
              )}
            </View>
          );
        })}

        {/* Welfare & Support */}
        <Text style={styles.sectionTitle}>Welfare & Support</Text>
        {mockData.welfare.map(item => (
          <View key={item.id} style={styles.welfareItem}>
            <View style={styles.welfareIconContainer}>
              <MaterialCommunityIcons 
                name={item.type === "Medical" ? "hospital-box" : "flower"} 
                color={item.type === "Medical" ? "#EF4444" : "#8B5CF6"} 
                size={20} 
              />
            </View>
            <View style={styles.welfareInfo}>
              <Text style={styles.welfareType}>{item.type} Assistance</Text>
              <Text style={styles.welfareMember}>{item.member}</Text>
              <Text style={styles.welfareDate}>{item.date}</Text>
            </View>
            <View style={styles.welfareRight}>
              <Text style={styles.welfareAmount}>KES {item.amount.toLocaleString('en-KE')}</Text>
              <View style={[styles.welfareStatus, { backgroundColor: `${statusColors[item.status]}20` }]}>
                <Text style={[styles.welfareStatusText, { color: statusColors[item.status] }]}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F8FA" },
  content: { padding: 16, paddingTop: 20 },
  pageTitle: { fontSize: 28, fontWeight: "700", color: "#17212B", marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#17212B", marginBottom: 12, marginTop: 20 },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  },
  groupIcon: { width: 50, height: 50, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 12 },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 14, fontWeight: "700", color: "#17212B", marginBottom: 4 },
  groupMembers: { fontSize: 12, color: "#667085" },
  groupAction: { padding: 8 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  },
  statValue: { fontSize: 18, fontWeight: "700", color: "#17212B", marginTop: 8, marginBottom: 4 },
  statLabel: { fontSize: 11, color: "#667085", textAlign: "center" },
  loanItem: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3B82F6",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  },
  loanHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  loanAmount: { fontSize: 16, fontWeight: "700", color: "#17212B", marginBottom: 2 },
  loanDate: { fontSize: 12, color: "#667085" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "600" },
  progressBarContainer: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  progressBar: { height: "100%", backgroundColor: "#3B82F6", borderRadius: 3 },
  repaymentText: { fontSize: 11, color: "#667085" },
  welfareItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  },
  welfareIconContainer: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center", backgroundColor: "#F3F4F6", marginRight: 12 },
  welfareInfo: { flex: 1 },
  welfareType: { fontSize: 14, fontWeight: "600", color: "#17212B", marginBottom: 2 },
  welfareMember: { fontSize: 12, color: "#667085", marginBottom: 2 },
  welfareDate: { fontSize: 11, color: "#9CA3AF" },
  welfareRight: { alignItems: "flex-end" },
  welfareAmount: { fontSize: 14, fontWeight: "700", color: "#17212B", marginBottom: 4 },
  welfareStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  welfareStatusText: { fontSize: 10, fontWeight: "600" },
});
