import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView as TabSafeArea } from "react-native-screens/experimental";

import { addItem, setQuantity, totals, type CartItem } from "@/cart";
import { useCart } from "@/cart-store";
import { Badge, Band, EmptyState, ErrorNotice, Icon, PlateNumber, SearchField, Stepper, styles as ui } from "@/components";
import { formatQuantity, formatRupiah, paymentLabel } from "@/format";
import { isLowStock, useProducts, useServices } from "@/queries";
import { color, family, radius, size, space, touch, type } from "@/theme";

type Row = CartItem & { stockLabel?: { label: string; tone: "neutral" | "warning" | "danger" } };
type Filter = "all" | "product" | "service";

export default function KasirScreen() {
  const products = useProducts();
  const services = useServices();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const { sections, counts } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (name: string, sku?: string | null) =>
      !needle || name.toLowerCase().includes(needle) || (sku ?? "").toLowerCase().includes(needle);
    const productRows: Row[] = (products.data ?? [])
      .filter((product) => matches(product.name, product.sku))
      .map((product) => ({
        kind: "product",
        id: product.id,
        name: product.name,
        unitPrice: product.sellingPrice,
        stockOnHand: product.stockOnHand,
        stockLabel: product.stockOnHand <= 0
          ? { label: "Habis", tone: "danger" }
          : isLowStock(product)
            ? { label: `Menipis · ${formatQuantity(product.stockOnHand)} ${product.unit}`, tone: "warning" }
            : { label: `Stok ${formatQuantity(product.stockOnHand)} ${product.unit}`, tone: "neutral" },
      }));
    const serviceRows: Row[] = (services.data ?? [])
      .filter((service) => matches(service.name))
      .map((service) => ({ kind: "service", id: service.id, name: service.name, unitPrice: service.sellingPrice }));
    return {
      counts: { product: productRows.length, service: serviceRows.length },
      sections: [
        { title: "Sparepart", kind: "product", data: productRows },
        { title: "Jasa", kind: "service", data: serviceRows },
      ].filter((section) => section.data.length > 0 && (filter === "all" || section.kind === filter)),
    };
  }, [products.data, services.data, query, filter]);

  const loading = products.isPending || services.isPending;
  const error = products.error ?? services.error;
  const refetch = () => { products.refetch(); services.refetch(); };

  return (
    <View style={styles.screen}>
      <Band title="Kasir" action={<VehicleChip />}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Cari sparepart, SKU, atau jasa" autoCapitalize="none" />
        <View accessibilityRole="tablist" style={styles.filters}>
          <FilterChip label="Semua" active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterChip label={`Sparepart ${counts.product}`} active={filter === "product"} onPress={() => setFilter("product")} />
          <FilterChip label={`Jasa ${counts.service}`} active={filter === "service"} onPress={() => setFilter("service")} />
        </View>
      </Band>
      {error && (
        <View style={{ padding: space.lg, paddingBottom: 0 }}>
          <ErrorNotice message={error.message} onRetry={refetch} />
        </View>
      )}
      <SectionList
        sections={sections}
        keyExtractor={(row) => `${row.kind}:${row.id}`}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={products.isRefetching || services.isRefetching} onRefresh={refetch} />}
        renderSectionHeader={({ section }) => <Text accessibilityRole="header" style={[ui.sectionTitle, styles.sectionTitle]}>{section.title}</Text>}
        renderItem={({ item, index, section }) => <CatalogRow row={item} first={index === 0} last={index === section.data.length - 1} />}
        ListEmptyComponent={
          loading ? undefined : query ? (
            <EmptyState title={`Tidak ada hasil untuk “${query.trim()}”`} body="Coba nama lain atau SKU." />
          ) : (
            <EmptyState title="Katalog masih kosong" body="Owner perlu menambahkan sparepart atau jasa lebih dulu." />
          )
        }
      />
      {/* iOS draws the floating tab bar over tab content, so the pinned plate needs the tab bar inset; Android already applies it. */}
      <TabSafeArea edges={{ bottom: Platform.OS === "ios" }} style={styles.totalArea}>
        <TotalPlate />
      </TabSafeArea>
    </View>
  );
}

// The workshop flow starts from the vehicle; the chip keeps it one tap away without blocking a walk-in sale.
function VehicleChip() {
  const vehicle = useCart((state) => state.cart.vehicle);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={vehicle ? `Kendaraan ${vehicle.plateNumber ?? "tanpa plat"}, ${vehicle.customerName}. Ubah` : "Pilih kendaraan"}
      onPress={() => router.push("/kendaraan")}
      style={({ pressed }) => [!vehicle && styles.vehicleEmpty, pressed && ui.pressed]}>
      {vehicle ? (
        <PlateNumber plateNumber={vehicle.plateNumber} />
      ) : (
        <>
          <Icon name={{ ios: "plus", android: "add" }} size={18} tint={color.onPlate} />
          <Text style={styles.chipLabel}>Kendaraan</Text>
        </>
      )}
    </Pressable>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && { color: color.plate }]}>{label}</Text>
    </Pressable>
  );
}

function CatalogRow({ row, first, last }: { row: Row; first: boolean; last: boolean }) {
  const quantity = useCart((state) => state.cart.lines.find((line) => line.kind === row.kind && line.id === row.id)?.quantity ?? 0);
  const update = useCart((state) => state.update);
  const soldOut = row.kind === "product" && (row.stockOnHand ?? 0) <= 0;

  return (
    <View style={[styles.row, first && styles.first, last && styles.last, !last && styles.separated, quantity > 0 && styles.rowSelected]}>
      <View style={styles.rowLine}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={type.title}>{row.name}</Text>
          {row.stockLabel ? <Badge label={row.stockLabel.label} tone={row.stockLabel.tone} /> : <Badge label="Jasa" />}
        </View>
        <Text style={styles.price}>{formatRupiah(row.unitPrice)}</Text>
        {/* Holds the key's width so prices stay on one shared column when the row is in the cart. */}
        {quantity > 0 && <View style={{ width: touch }} />}
        {quantity === 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={soldOut ? `${row.name} habis` : `Tambah ${row.name}`}
            accessibilityState={{ disabled: soldOut }}
            disabled={soldOut}
            onPress={() => update((cart) => addItem(cart, row))}
            style={({ pressed }) => [styles.add, soldOut && ui.inactive, pressed && ui.pressed]}>
            <Icon name={{ ios: "plus", android: "add" }} tint={color.onPlate} />
          </Pressable>
        )}
      </View>
      {quantity > 0 && (
        <View style={styles.stepperLine}>
          <Stepper
            label={row.name}
            quantity={quantity}
            max={row.kind === "product" ? row.stockOnHand : undefined}
            onChange={(next) => update((cart) => setQuantity(cart, row, next))}
          />
        </View>
      )}
    </View>
  );
}

function TotalPlate() {
  const cart = useCart((state) => state.cart);
  if (cart.lines.length === 0) return null;
  const itemCount = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = formatRupiah(totals(cart).total);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Bayar ${itemCount} item, total ${total}`}
      onPress={() => router.push("/checkout")}
      style={({ pressed }) => [styles.plateBar, pressed && ui.pressed]}>
      <View style={styles.plateFace}>
        <Text style={styles.plateTotal} adjustsFontSizeToFit numberOfLines={1}>{total}</Text>
        <Text style={styles.plateMeta}>{itemCount} item · {paymentLabel[cart.paymentMethod]}</Text>
      </View>
      <View style={styles.pay}>
        <Text style={styles.payLabel}>Bayar</Text>
        <Icon name={{ ios: "chevron.right", android: "chevron_right" }} size={20} tint={color.onAction} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  filters: { flexDirection: "row", gap: space.sm },
  chip: { minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: 2, borderColor: color.onPlate, justifyContent: "center" },
  vehicleEmpty: { minHeight: touch, flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: 2, borderColor: color.onPlate },
  chipActive: { backgroundColor: color.onPlate },
  chipLabel: { fontFamily: family.semibold, fontSize: size.sm, color: color.onPlate },
  list: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  sectionTitle: { marginTop: space.lg, marginBottom: space.sm },
  row: { backgroundColor: color.surface, paddingLeft: space.lg, paddingRight: space.md, paddingVertical: space.md, gap: space.sm },
  // In-cart rows are marked by a plate-black outline; yellow stays reserved for actions.
  // Padding shrinks by the outline width so the price column does not shift.
  rowSelected: { borderWidth: 2, borderBottomWidth: 2, borderColor: color.plate, borderBottomColor: color.plate, paddingLeft: space.lg - 2, paddingRight: space.md - 2, paddingVertical: space.md - 2 },
  rowLine: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepperLine: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  first: { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  last: { borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md },
  separated: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  price: { ...type.figure, fontSize: size.lg, minWidth: 88, textAlign: "right" },
  add: { width: touch, height: touch, borderRadius: radius.sm, backgroundColor: color.plate, alignItems: "center", justifyContent: "center" },
  totalArea: { flex: 0 },
  plateBar: {
    flexDirection: "row",
    marginHorizontal: space.lg,
    marginBottom: space.md,
    minHeight: 76,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: color.plate,
  },
  plateFace: {
    flex: 1,
    margin: 6,
    paddingHorizontal: space.md,
    borderWidth: 2,
    borderColor: color.onPlate,
    borderRadius: radius.sm,
    justifyContent: "center",
  },
  plateTotal: { ...type.figure, fontSize: size.xxl, color: color.onPlate, lineHeight: size.xxl + 2 },
  plateMeta: { ...type.caps, color: color.onPlate },
  pay: { width: 112, flexDirection: "row", gap: 2, backgroundColor: color.action, alignItems: "center", justifyContent: "center" },
  payLabel: { fontFamily: family.bold, fontSize: size.lg, color: color.onAction },
});
