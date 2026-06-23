import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { api, setToken } from "../lib/api";
import { theme } from "../theme";

export default function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setError("");
    try {
      const res = mode === "login"
        ? await api.login(email, password)
        : await api.signup(email, password, name);
      await setToken(res.token);
      onAuthed();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.brand}>Face<Text style={{ color: theme.brand }}>Guard</Text></Text>
      <Text style={styles.sub}>Find where your own photos appear online.</Text>
      {mode === "signup" && (
        <TextInput style={styles.input} placeholder="Name" placeholderTextColor={theme.muted}
          value={name} onChangeText={setName} />
      )}
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor={theme.muted}
        autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor={theme.muted}
        secureTextEntry value={password} onChangeText={setPassword} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.btn} onPress={submit} disabled={busy}>
        <Text style={styles.btnText}>{busy ? "…" : mode === "login" ? "Log in" : "Create account"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMode(mode === "login" ? "signup" : "login")}>
        <Text style={styles.link}>
          {mode === "login" ? "No account? Sign up" : "Have an account? Log in"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, padding: 24, justifyContent: "center" },
  brand: { fontSize: 34, fontWeight: "800", color: theme.text },
  sub: { color: theme.muted, marginBottom: 24, marginTop: 6 },
  input: { backgroundColor: theme.panel2, color: theme.text, borderRadius: 10,
    padding: 14, marginTop: 12, borderWidth: 1, borderColor: theme.border },
  btn: { backgroundColor: theme.brand, borderRadius: 10, padding: 15, alignItems: "center", marginTop: 18 },
  btnText: { color: "#fff", fontWeight: "700" },
  link: { color: theme.brand, textAlign: "center", marginTop: 16 },
  error: { color: theme.bad, marginTop: 10 },
});
