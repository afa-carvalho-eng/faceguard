import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthScreen from "./src/screens/AuthScreen";
import ScanScreen from "./src/screens/ScanScreen";
import { getToken } from "./src/lib/api";
import { theme } from "./src/theme";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => { getToken().then((t) => setAuthed(!!t)); }, []);

  return (
    <SafeAreaProvider>
      {authed === null ? (
        <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: "center" }}>
          <ActivityIndicator color={theme.brand} />
        </View>
      ) : authed ? (
        <ScanScreen onLogout={() => setAuthed(false)} />
      ) : (
        <AuthScreen onAuthed={() => setAuthed(true)} />
      )}
    </SafeAreaProvider>
  );
}
