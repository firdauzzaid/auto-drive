import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Band, Button, Icon, Section, styles as ui } from "@/components";
import { useSession } from "@/session";
import { color, space, type } from "@/theme";

export default function LainnyaScreen() {
  const { session, signOut } = useSession();
  const [busy, setBusy] = useState(false);

  return (
    <View style={styles.screen}>
      <Band title="Lainnya" />
      <View style={styles.content}>
        <View style={[ui.list, ui.row]}>
          <Text style={[type.body, { flex: 1 }]}>Masuk sebagai</Text>
          <Text style={type.title}>{session?.role === "owner" ? "Owner" : "Kasir"}</Text>
        </View>
        {session?.role === "owner" && (
          <Section title="Katalog">
            <View style={ui.list}>
              <CatalogLink label="Tambah sparepart" kind="product" />
              <View style={ui.divider} />
              <CatalogLink label="Tambah jasa" kind="service" />
            </View>
          </Section>
        )}
        <Button
          label="Keluar"
          variant="secondary"
          loading={busy}
          onPress={() => {
            setBusy(true);
            signOut();
          }}
        />
      </View>
    </View>
  );
}

function CatalogLink({ label, kind }: { label: string; kind: "product" | "service" }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/katalog", params: { kind } })}
      style={({ pressed }) => [ui.row, pressed && ui.pressed]}>
      <Text style={[type.title, { flex: 1 }]}>{label}</Text>
      <Icon name={{ ios: "chevron.right", android: "chevron_right" }} size={18} tint={color.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  content: { gap: space.xl, padding: space.lg },
});
