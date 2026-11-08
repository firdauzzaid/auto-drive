import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { apiRequest } from "@/api";
import { Button, ErrorNotice, Field } from "@/components";
import { parseQuantity } from "@/format";
import { keys } from "@/queries";
import { useSession } from "@/session";
import { color, space, type } from "@/theme";

const digits = (text: string) => text.replace(/\D/g, "");

// Same rule as the API's quantity schema, so the form rejects exactly what the server would.
function quantityError(text: string, label: string) {
  if (!text.trim()) return null;
  const value = parseQuantity(text);
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value * 1000)) return `${label} harus angka 0 atau lebih, maksimal 3 angka di belakang koma.`;
  return null;
}

// Owner-only catalog entry so a pilot workshop can start selling without the API docs.
export default function KatalogScreen() {
  const { kind } = useLocalSearchParams<{ kind?: "product" | "service" }>();
  const isProduct = kind !== "service";
  const session = useSession((state) => state.session);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [minimum, setMinimum] = useState("");
  const [initial, setInitial] = useState("");
  // Product and opening stock are two calls; a retry after the second fails must not create the product twice.
  const [createdId, setCreatedId] = useState<string | null>(null);

  const problem =
    !name.trim() ? `Nama ${isProduct ? "sparepart" : "jasa"} wajib diisi.`
      : isProduct && !unit.trim() ? "Satuan wajib diisi, mis. pcs, botol, liter."
        : !price ? "Harga jual wajib diisi."
          : isProduct ? quantityError(minimum, "Stok minimum") ?? quantityError(initial, "Stok awal") : null;

  const save = useMutation({
    mutationFn: async () => {
      if (!isProduct) {
        await apiRequest(session, "/services", { method: "POST", body: { name: name.trim(), sellingPrice: Number(price) } });
        return;
      }
      const productId = createdId ?? (await apiRequest<{ id: string }>(session, "/products", {
        method: "POST",
        body: {
          name: name.trim(),
          unit: unit.trim(),
          sellingPrice: Number(price),
          ...(sku.trim() ? { sku: sku.trim() } : {}),
          ...(cost ? { currentCost: Number(cost) } : {}),
          ...(minimum.trim() ? { minimumStock: parseQuantity(minimum) } : {}),
        },
      })).id;
      setCreatedId(productId);
      const opening = initial.trim() ? parseQuantity(initial) : 0;
      // shortcut: adjustments have no idempotency key, so a lost response then retry can double the opening stock; upgrade when the API accepts Idempotency-Key here.
      if (opening > 0) {
        await apiRequest(session, "/inventory/adjustments", {
          method: "POST",
          body: { productId, quantityChange: opening, reason: "Stok awal" },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: isProduct ? keys.products : keys.services });
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
      router.back();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.products }),
  });

  const errorMessage = save.error && (createdId
    ? `Sparepart sudah tersimpan, tapi stok awal belum tercatat. ${save.error.message}`
    : save.error.message);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isProduct ? "Tambah Sparepart" : "Tambah Jasa" }} />
      <Field label={isProduct ? "Nama sparepart" : "Nama jasa"} value={name} onChangeText={setName} placeholder={isProduct ? "mis. Oli Yamalube 0,8 L" : "mis. Ganti oli"} editable={!createdId} />
      {isProduct && (
        <View style={styles.pair}>
          <View style={{ flex: 1 }}>
            <Field label="Satuan" value={unit} onChangeText={setUnit} placeholder="pcs, botol, liter" autoCapitalize="none" editable={!createdId} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="SKU (opsional)" value={sku} onChangeText={setSku} placeholder="Kode barang" autoCapitalize="characters" editable={!createdId} />
          </View>
        </View>
      )}
      <Field label={isProduct ? "Harga jual (Rp)" : "Harga jasa (Rp)"} value={price} onChangeText={(text) => setPrice(digits(text))} keyboardType="number-pad" placeholder={isProduct ? "mis. 45000" : "mis. 25000"} editable={!createdId} />
      {isProduct && (
        <>
          <View style={{ gap: space.xs }}>
            <Field label="Harga modal (Rp, opsional)" value={cost} onChangeText={(text) => setCost(digits(text))} keyboardType="number-pad" placeholder="mis. 38000" editable={!createdId} />
            <Text style={type.muted}>Dipakai untuk menghitung laba kotor.</Text>
          </View>
          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <Field label={`Stok awal (${unit.trim() || "satuan"})`} value={initial} onChangeText={setInitial} keyboardType="decimal-pad" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Stok minimum" value={minimum} onChangeText={setMinimum} keyboardType="decimal-pad" placeholder="0" editable={!createdId} />
            </View>
          </View>
        </>
      )}
      {(errorMessage || (problem && (name || price))) && <ErrorNotice message={errorMessage || problem!} />}
      <Button
        label={createdId ? "Coba catat stok awal" : "Simpan"}
        onPress={() => save.mutate()}
        loading={save.isPending}
        disabled={!!problem}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  content: { gap: space.lg, padding: space.lg, paddingBottom: space.xxl },
  pair: { flexDirection: "row", gap: space.sm },
});
