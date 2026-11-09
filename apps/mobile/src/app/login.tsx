import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, ErrorNotice, Field, Plate } from "@/components";
import { useSession } from "@/session";
import { color, size, space, type } from "@/theme";

export default function LoginScreen() {
  const signIn = useSession((state) => state.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (caught) {
      setError((caught as Error).message);
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.band}>
        <Plate style={{ alignSelf: "flex-start" }}>
          <Text style={styles.mark}>KASIR BENGKEL</Text>
        </Plate>
        <Text accessibilityRole="header" style={styles.title}>Masuk untuk mulai transaksi</Text>
      </SafeAreaView>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={type.muted}>Pakai akun owner atau kasir bengkel Anda.</Text>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            placeholder="nama@bengkel.id"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={submit}
          />
          {error && <ErrorNotice message={error} />}
          <Button label="Masuk" onPress={submit} loading={busy} disabled={!email.trim() || !password} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  band: { backgroundColor: color.plate, paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.xl, gap: space.lg },
  mark: { ...type.figure, fontSize: size.xxl, color: color.onPlate, letterSpacing: 2 },
  title: { ...type.display, fontSize: size.xl },
  form: { gap: space.lg, padding: space.xl },
});
