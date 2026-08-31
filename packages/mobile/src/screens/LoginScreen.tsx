import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../services/supabase";

export default function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    setMessage("");

    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } });

    if (result.error) setError(result.error.message);
    else if (mode === "signup" && !result.data.session) setMessage("Account created. Check your email to confirm it.");

    setSubmitting(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.brand}>PesaFlow</Text>
        <Text style={styles.title}>{mode === "signin" ? "Welcome back" : "Create your account"}</Text>
        <Text style={styles.subtitle}>Your money, groups, and business in one place.</Text>

        {mode === "signup" && (
          <TextInput value={name} onChangeText={setName} placeholder="Full name" style={styles.input} />
        )}
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <TouchableOpacity onPress={submit} disabled={submitting} style={styles.button}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{mode === "signin" ? "Sign in" : "Create account"}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}>
          <Text style={styles.switchText}>{mode === "signin" ? "New to PesaFlow? Create an account" : "Already have an account? Sign in"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", backgroundColor: "#F5F8FA", padding: 20 },
  panel: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  brand: { color: "#10B981", fontSize: 16, fontWeight: "700", marginBottom: 18 },
  title: { color: "#17212B", fontSize: 28, fontWeight: "700" },
  subtitle: { color: "#667085", fontSize: 14, marginTop: 8, marginBottom: 24 },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, marginBottom: 12, color: "#17212B" },
  button: { backgroundColor: "#10B981", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
  switchText: { color: "#0EA5E9", textAlign: "center", marginTop: 18, fontSize: 13 },
  error: { color: "#B91C1C", backgroundColor: "#FEF2F2", padding: 10, borderRadius: 10, marginBottom: 8 },
  message: { color: "#047857", backgroundColor: "#ECFDF5", padding: 10, borderRadius: 10, marginBottom: 8 },
});