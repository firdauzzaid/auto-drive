import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { Badge, Band, EmptyState, ErrorNotice, Icon, SearchField, styles as ui } from "@/components";
import { formatQuantity, formatRupiah } from "@/format";
import { isLowStock, useProducts } from "@/queries";
import { useSession } from "@/session";
import { color, family, radius, size, space, touch, type } from "@/theme";

// Read-only stock list; purchases and movement history arrive in the Stok phase.
export default function StokScreen() {
  const products = useProducts();
  const isOwner = useSession((state) => state.session?.role === "owner");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (products.data ?? []).filter(
      (product) => !needle || product.name.toLowerCase().includes(needle) || (product.sku ?? "").toLowerCase().includes(needle),
    );
  }, [products.data, query]);

  return (
    <View style={styles.screen}>
      <Band
        title="Stok"
        action={isOwner ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tambah sparepart"
            onPress={() => router.push({ pathname: "/katalog", params: { kind: "product" } })}
            style={({ pressed }) => [styles.add, pressed && ui.pressed]}>
            <Icon name={{ ios: "plus", android: "add" }} size={18} tint={color.onPlate} />
            <Text style={styles.addLabel}>Sparepart</Text>
          </Pressable>
        ) : undefined}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Cari sparepart atau SKU" autoCapitalize="none" />
      </Band>
      <FlatList
        data={rows}
        keyExtractor={(product) => product.id}
        contentContainerStyle={styles.list}
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => { products.refetch(); }} />}
        ListHeaderComponent={products.error ? <ErrorNotice message={products.error.message} onRetry={() => products.refetch()} /> : undefined}
        renderItem={({ item, index }) => (
          <View style={[styles.row, index === 0 && styles.first, index === rows.length - 1 && styles.last, index < rows.length - 1 && styles.separated]}>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text style={type.title}>{item.name}</Text>
              <Text style={type.muted}>{[item.sku, formatRupiah(item.sellingPrice)].filter(Boolean).join(" · ")}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: space.xs }}>
              <Text style={styles.stock}>{formatQuantity(item.stockOnHand)} <Text style={styles.unit}>{item.unit}</Text></Text>
              {item.stockOnHand <= 0 ? <Badge label="Habis" tone="danger" /> : isLowStock(item) ? <Badge label="Menipis" tone="warning" /> : null}
            </View>
          </View>
        )}
        ListEmptyComponent={products.isPending ? undefined : <EmptyState title={query ? "Tidak ada sparepart yang cocok" : "Belum ada sparepart"} body={!query && isOwner ? "Tekan Sparepart di atas untuk menambah barang pertama." : undefined} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  list: { padding: space.lg, gap: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, backgroundColor: color.surface },
  first: { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  last: { borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md },
  separated: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  stock: { ...type.figure, fontSize: size.xl },
  add: { minHeight: touch, flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md, borderRadius: radius.sm, borderWidth: 2, borderColor: color.onPlate },
  addLabel: { fontFamily: family.semibold, fontSize: size.sm, color: color.onPlate },
  unit: { ...type.figure, fontSize: size.sm, color: color.textMuted },
});
