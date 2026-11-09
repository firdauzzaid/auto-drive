import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Fragment } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { apiRequest, type VehicleVisit } from "@/api";
import { EmptyState, ErrorNotice, Icon, PlateNumber, Section, styles as ui } from "@/components";
import { formatDateTime, formatRupiah } from "@/format";
import { useSession } from "@/session";
import { color, size, space, type } from "@/theme";

// shortcut: the API returns sale headers only (no km, no items), so each visit opens its receipt for the detail; upgrade when GET /vehicles/:id/history returns items and kilometer.
export default function VehicleHistoryScreen() {
  const session = useSession((state) => state.session);
  const { id, plate, name } = useLocalSearchParams<{ id: string; plate?: string; name?: string }>();
  const history = useQuery({
    queryKey: ["vehicle-history", id],
    queryFn: () => apiRequest<VehicleVisit[]>(session, `/vehicles/${id}/history`),
  });
  const visits = history.data ?? [];
  const spent = visits.reduce((sum, visit) => sum + visit.total, 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={history.isRefetching} onRefresh={() => { history.refetch(); }} />}>
      <View style={styles.head}>
        <PlateNumber plateNumber={plate || null} large />
        {name ? <Text style={[type.heading, { flex: 1 }]} numberOfLines={2}>{name}</Text> : null}
      </View>

      {history.error && <ErrorNotice message={history.error.message} onRetry={() => history.refetch()} />}
      {history.data && (
        <View style={ui.list}>
          <Stat label="Terakhir datang" value={visits[0] ? formatDateTime(visits[0].completedAt) : "—"} />
          <View style={ui.divider} />
          <Stat label="Jumlah kunjungan" value={String(visits.length)} />
          <View style={ui.divider} />
          <Stat label="Total belanja" value={formatRupiah(spent)} />
        </View>
      )}

      {history.data && (
        <Section title="Riwayat servis">
          <View style={ui.list}>
            {visits.length === 0 ? (
              <EmptyState title="Belum ada servis tercatat" body="Transaksi yang memakai kendaraan ini akan muncul di sini." />
            ) : (
              visits.map((visit, index) => (
                <Fragment key={visit.id}>
                  {index > 0 && <View style={ui.divider} />}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Buka bukti ${visit.transactionNumber}`}
                    onPress={() => router.push(`/sales/${visit.id}`)}
                    style={({ pressed }) => [ui.row, pressed && ui.pressed]}>
                    <View style={{ flex: 1, gap: space.xs }}>
                      <Text style={type.title}>{formatDateTime(visit.completedAt)}</Text>
                      <Text style={styles.trx}>{visit.transactionNumber}</Text>
                    </View>
                    <Text style={ui.money}>{formatRupiah(visit.total)}</Text>
                    <Icon name={{ ios: "chevron.right", android: "chevron_right" }} size={18} tint={color.textMuted} />
                  </Pressable>
                </Fragment>
              ))
            )}
          </View>
        </Section>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={ui.row}>
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
      <Text style={ui.money}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  content: { gap: space.xl, padding: space.lg, paddingBottom: space.xxl },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  trx: { ...type.figure, fontSize: size.sm, letterSpacing: 1, color: color.textMuted },
});
