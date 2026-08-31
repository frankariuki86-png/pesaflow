import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../services/supabase";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.user.id) return;
      const { data } = await supabase.from("profiles").select("full_name, phone").eq("id", session.user.id).maybeSingle();
      setFullName(data?.full_name || session.user.user_metadata.full_name || session.user.email?.split("@")[0] || "User");
      setPhone(data?.phone || session.user.user_metadata.phone || "");
      setLoading(false);
    };
    void loadProfile();
  }, [session?.user.id]);

  const save = async () => {
    if (!session?.user.id || !fullName.trim()) return;
    setSaving(true); setMessage("");
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim(), phone: phone.trim() || null }).eq("id", session.user.id);
    setMessage(error ? "Unable to save your profile." : "Profile saved successfully.");
    setSaving(false);
  };

  const logout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => { void signOut(); } },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#10B981" /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>ACCOUNT</Text>
      <Text style={styles.title}>Profile & Settings</Text>
      <View style={styles.avatar}><Text style={styles.avatarText}>{fullName.charAt(0).toUpperCase()}</Text></View>
      <Text style={styles.email}>{session?.user.email}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Full name</Text>
        <TextInput value={fullName} onChangeText={setFullName} style={styles.input} />
        <Text style={styles.label}>Phone number</Text>
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+254 7XX XXX XXX" style={styles.input} />
        <TouchableOpacity onPress={save} disabled={saving} style={styles.button}><Text style={styles.buttonText}>{saving ? "Saving..." : "Save profile"}</Text></TouchableOpacity>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Security</Text>
        <Text style={styles.muted}>Your account uses Supabase Auth with a persistent session.</Text>
        <TouchableOpacity onPress={logout} style={styles.signOut}><Text style={styles.signOutText}>Sign Out</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F8FA", padding: 20 }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, eyebrow: { color: "#10B981", fontSize: 12, fontWeight: "700", letterSpacing: 2 }, title: { color: "#17212B", fontSize: 28, fontWeight: "700", marginTop: 8 }, avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center", marginTop: 24 }, avatarText: { color: "#FFFFFF", fontSize: 30, fontWeight: "700" }, email: { color: "#667085", fontSize: 14, marginTop: 10, marginBottom: 24 }, card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 18, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }, label: { color: "#17212B", fontSize: 13, fontWeight: "600", marginBottom: 7, marginTop: 12 }, input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 11, padding: 13, color: "#17212B" }, button: { backgroundColor: "#10B981", borderRadius: 11, padding: 14, alignItems: "center", marginTop: 18 }, buttonText: { color: "#FFFFFF", fontWeight: "700" }, message: { color: "#047857", marginTop: 12 }, sectionTitle: { color: "#17212B", fontSize: 17, fontWeight: "700" }, muted: { color: "#667085", fontSize: 13, marginTop: 7 }, signOut: { borderWidth: 1, borderColor: "#DC2626", borderRadius: 11, padding: 13, alignItems: "center", marginTop: 18 }, signOutText: { color: "#DC2626", fontWeight: "700" },
});
