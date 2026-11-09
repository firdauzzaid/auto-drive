import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Fragment } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { apiRequest, type Dashboard, type PeriodReport } from "@/api";
import { Badge, Band, Button, EmptyState, ErrorNotice, Icon, Plate, Section, styles as ui } from "@/components";
import { formatDateTime, formatQuantity, formatRupiah, todayRange } from "@/format";
import { isLowStock, keys, useProducts } from "@/queries";
import { useSession } from "@/session";
import { color, size, space, type } from "@/theme";

type LowStockItem = { id: string; name: string; stockOnHand: number; minimumStock: number };

export default function HomeScreen() {
  const role = useSession((state) => state.session?.role);
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
  return (
    <View style={styles.screen}>
      <Band title="Hari ini" subtitle={today} />
      {role === "owner" ? <OwnerHome /> : <CashierHome />}
    </View>
  );
}

function OwnerHome() {
  const session = useSession((state) => state.session);
  const range = todayRange();
  const summary = useQuery({
    queryKey: [...keys.summary, range.from],
    queryFn: () => apiRequest<PeriodReport>(session, `/reports/summary?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`),
  });
  const dashboard = useQuery({ queryKey: keys.dashboard, queryFn: () => apiRequest<Dashboard>(session, "/dashboard") });
  const refreshing = summary.isRefetching || dashboard.isRefetching;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { summary.refetch(); dashboard.refetch(); }} />}>
      {summary.error && <ErrorNotice message={summary.error.message} onRetry={() => summary.refetch()} />}
      {summary.data && (
        <View style={{ gap: space.sm }}>
          <Plate>
            <Text style={[type.caps, { color: color.onPlate }]}>Omzet hari ini</Text>
            <Text style={styles.revenue} adjustsFontSizeToFit numberOfLines={1}>{formatRupiah(summary.data.revenue)}</Text>
          </Plate>
          <View style={ui.list}>
            <SummaryRow label="Transaksi" value={String(summary.data.transactionCount)} first />
            <SummaryRow label="Estimasi laba kotor" value={formatRupiah(summary.data.grossProfit)} />
            <SummaryRow label="Pengeluaran" value={formatRupiah(summary.data.expenseTotal)} />
          </View>
        </View>
      )}
      <Button label="Transaksi Baru" onPress={() => router.navigate("/kasir")} />
      {dashboard.error && <ErrorNotice message={dashboard.error.message} onRetry={() => dashboard.refetch()} />}
      {summary.data && <TopProducts items={summary.data.topProducts} />}
      {dashboard.data && <LowStock items={dashboard.data.lowStock} />}
      {summary.data && (
        <Section title="Transaksi terakhir">
          {summary.data.recentTransactions.length === 0 ? (
            <View style={ui.list}>
              <EmptyState title="Belum ada transaksi hari ini" body="Transaksi yang selesai akan muncul di sini." />
            </View>
          ) : (
            <View style={ui.list}>
              {summary.data.recentTransactions.map((sale, index) => (
                <Fragment key={sale.id}>
                  {index > 0 && <View style={ui.divider} />}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Buka bukti transaksi ${sale.transactionNumber}`}
                    onPress={() => router.push(`/sales/${sale.id}`)}
                    style={({ pressed }) => [ui.row, pressed && ui.pressed]}>
                    <View style={{ flex: 1, gap: space.xs }}>
                      <Text style={styles.trx}>{sale.transactionNumber}</Text>
                      <Text style={type.muted}>{formatDateTime(sale.completedAt)}</Text>
                    </View>
                    <Text style={ui.money}>{formatRupiah(sale.total)}</Text>
                    <Icon name={{ ios: "chevron.right", android: "chevron_right" }} size={18} tint={color.textMuted} />
                  </Pressable>
                </Fragment>
              ))}
            </View>
          )}
        </Section>
      )}
    </ScrollView>
  );
}

function CashierHome() {
  const products = useProducts();
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => { products.refetch(); }} />}>
      <Button label="Transaksi Baru" onPress={() => router.navigate("/kasir")} />
      {products.error && <ErrorNotice message={products.error.message} onRetry={() => products.refetch()} />}
      {products.data && <LowStock items={products.data.filter(isLowStock)} />}
    </ScrollView>
  );
}

function SummaryRow({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <>
      {!first && <View style={ui.divider} />}
      <View style={ui.row}>
        <Text style={[type.body, { flex: 1 }]}>{label}</Text>
        <Text style={ui.money}>{value}</Text>
      </View>
    </>
  );
}

function TopProducts({ items }: { items: PeriodReport["topProducts"] }) {
  return (
    <Section title="Sparepart terlaris hari ini">
      <View style={ui.list}>
        {items.length === 0 ? (
          <EmptyState title="Belum ada sparepart terjual hari ini" />
        ) : (
          items.map((item, index) => (
            <Fragment key={item.productId}>
              {index > 0 && <View style={ui.divider} />}
              <View style={ui.row}>
                <View style={{ flex: 1, gap: space.xs }}>
                  <Text style={type.title}>{item.name}</Text>
                  <Text style={type.muted}>{formatQuantity(item.quantity)} terjual</Text>
                </View>
                <Text style={ui.money}>{formatRupiah(item.revenue)}</Text>
              </View>
            </Fragment>
          ))
        )}
      </View>
    </Section>
  );
}

function LowStock({ items }: { items: LowStockItem[] }) {
  return (
    <Section title="Stok menipis">
      <View style={ui.list}>
        {items.length === 0 ? (
          <EmptyState title="Semua stok aman" body="Belum ada sparepart di bawah stok minimum." />
        ) : (
          items.map((item, index) => (
            <Fragment key={item.id}>
              {index > 0 && <View style={ui.divider} />}
              <View style={ui.row}>
                <View style={{ flex: 1, gap: space.xs }}>
                  <Text style={type.title}>{item.name}</Text>
                  <Text style={type.muted}>Minimum {formatQuantity(item.minimumStock)}</Text>
                </View>
                <Badge label={item.stockOnHand <= 0 ? "Habis" : `Sisa ${formatQuantity(item.stockOnHand)}`} tone={item.stockOnHand <= 0 ? "danger" : "warning"} />
              </View>
            </Fragment>
          ))
        )}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  content: { gap: space.xl, padding: space.lg, paddingBottom: space.xxl },
  revenue: { ...type.figure, fontSize: size.xxl, color: color.onPlate, lineHeight: size.xxl + 4 },
  trx: { ...type.figure, fontSize: size.md, letterSpacing: 1 },
});
