import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Switch, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api, clearToken } from "../lib/api";
import { theme } from "../theme";

export default function ScanScreen({ onLogout }: { onLogout: () => void }) {
  const [uri, setUri] = useState<string | null>(null);
  const [ownPhoto, setOwnPhoto] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any | null>(null);

  async function pick(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Permission denied"); return; }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!res.canceled) { setUri(res.assets[0].uri); setResult(null); }
  }

  async function scan() {
    if (!uri || !ownPhoto || !terms) return;
    setBusy(true); setError("");
    try {
      setResult(await api.createScan(uri, ownPhoto, terms));
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.headerRow}>
        <Text style={styles.h1}>New scan</Text>
        <TouchableOpacity onPress={async () => { await clearToken(); onLogout(); }}>
          <Text style={{ color: theme.muted }}>Log out</Text>
        </TouchableOpacity>
      </View>

      {uri && <Image source={{ uri }} style={styles.preview} />}
      <View style={styles.row}>
        <TouchableOpacity style={styles.btnGhost} onPress={() => pick(true)}>
          <Text style={styles.btnGhostText}>Take photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGhost} onPress={() => pick(false)}>
          <Text style={styles.btnGhostText}>Choose photo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.consent}>
        <Switch value={ownPhoto} onValueChange={setOwnPhoto} />
        <Text style={styles.consentText}>This is a photo of myself and I consent to the search.</Text>
      </View>
      <View style={styles.consent}>
        <Switch value={terms} onValueChange={setTerms} />
        <Text style={styles.consentText}>I accept the Terms.</Text>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={[styles.btn, (!uri || !ownPhoto || !terms) && { opacity: 0.5 }]}
        onPress={scan} disabled={busy || !uri || !ownPhoto || !terms}>
        <Text style={styles.btnText}>{busy ? "Scanning…" : "Run scan"}</Text>
      </TouchableOpacity>

      {result && (
        <View style={{ marginTop: 24 }}>
          <Text style={styles.h2}>Results ({result.matchCount})</Text>
          {result.status === "failed" && <Text style={styles.error}>{result.error}</Text>}
          {result.matches?.length === 0 && <Text style={{ color: theme.muted }}>No public matches found.</Text>}
          {result.matches?.map((m: any, i: number) => (
            <TouchableOpacity key={i} style={styles.match}
              onPress={() => Linking.openURL(m.pageUrl || m.url)}>
              <Text style={{ color: theme.text }}>{m.siteName || m.url}</Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>
                {m.kind} · {Math.round(m.confidence * 100)}% image
                {typeof m.faceConfidence === "number"
                  ? `  ·  ${m.faceVerified ? "✓ face" : "face?"} ${Math.round(m.faceConfidence * 100)}%`
                  : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  h1: { fontSize: 26, fontWeight: "800", color: theme.text },
  h2: { fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 10 },
  preview: { width: "100%", height: 240, borderRadius: 14, marginTop: 16, backgroundColor: theme.panel2 },
  row: { flexDirection: "row", gap: 12, marginTop: 16 },
  btnGhost: { flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 13, alignItems: "center", backgroundColor: theme.panel2 },
  btnGhostText: { color: theme.text, fontWeight: "600" },
  consent: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  consentText: { color: theme.muted, flex: 1 },
  btn: { backgroundColor: theme.brand, borderRadius: 10, padding: 15, alignItems: "center", marginTop: 20 },
  btnText: { color: "#fff", fontWeight: "700" },
  match: { backgroundColor: theme.panel, borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1, borderColor: theme.border },
  error: { color: theme.bad, marginTop: 12 },
});
