import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { Fragment } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, apiRequest } from "@/api";
import { prepareCheckout, setDiscount, setPaymentMethod, setQuantity, totals, type PaymentMethod } from "@/cart";
import { useCart } from "@/cart-store";
import { Button, EmptyState, ErrorNotice, Icon, Plate, PlateNumber, Section, Stepper, styles as ui } from "@/components";
import { formatRupiah, paymentLabel } from "@/format";
import { keys } from "@/queries";
import { useSession } from "@/session";
import { color, family, radius, size, space, touch, type } from "@/theme";

export default function CheckoutScreen() {
  const session = useSession((state) => state.session);
  const { cart, update, reset } = useCart();
  const queryClient = useQueryClient();
  const summary = totals(cart);

  const checkout = useMutation({
    mutationFn: async () => {
      const prepared = prepareCheckout(cart, Crypto.randomUUID);
      update(() => prepared.cart);
      return apiRequest<{ id: string; total: number }>(session, "/sales", {
        method: "POST",
        body: prepared.body,
        idempotencyKey: prepared.idempotencyKey,
      });
    },
    onSuccess: (sale) => {
      reset();
      for (const key of [keys.products, keys.dashboard, keys.summary, ["vehicle-history"]]) queryClient.invalidateQueries({ queryKey: key });
      router.replace(`/sales/${sale.id}`);
    },
    onError: (error) => {
      // Stock moved since the catalog loaded; refresh it so the cashier sees the real numbers.
      if (error instanceof ApiError && error.status === 400) queryClient.invalidateQueries({ queryKey: keys.products });
    },
  });

  if (cart.lines.length === 0) {
    return <EmptyState title="Keranjang kosong" body="Tambahkan sparepart atau jasa dari tab Kasir." />;
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Section title="Keranjang">
          <View style={ui.list}>
            {cart.lines.map((line, index) => (
              <Fragment key={`${line.kind}:${line.id}`}>
                {index > 0 && <View style={ui.divider} />}
                <View style={[ui.row, { flexDirection: "column", alignItems: "stretch", gap: space.sm }]}>
                  <View style={styles.lineTop}>
                    <Text style={[type.title, { flex: 1 }]}>{line.name}</Text>
                    <Text style={ui.money}>{formatRupiah(line.unitPrice * line.quantity)}</Text>
                  </View>
                  <View style={styles.lineTop}>
                    <Text style={[type.muted, { flex: 1 }]}>{formatRupiah(line.unitPrice)} / {line.kind === "product" ? "item" : "jasa"}</Text>
                    <Stepper
                      label={line.name}
                      quantity={line.quantity}
                      max={line.kind === "product" ? line.stockOnHand : undefined}
                      onChange={(next) => update((current) => setQuantity(current, line, next))}
                    />
                  </View>
                </View>
              </Fragment>
            ))}
          </View>
        </Section>

        <VehicleRow />

        <Section title="Diskon transaksi">
          <View style={styles.discount}>
            <Text style={styles.currency}>Rp</Text>
            <TextInput
              accessibilityLabel="Diskon transaksi dalam Rupiah"
              keyboardType="number-pad"
              value={cart.discount ? String(cart.discount) : ""}
              onChangeText={(text) => update((current) => setDiscount(current, Number(text.replace(/\D/g, ""))))}
              placeholder="0"
              placeholderTextColor={color.textMuted}
              style={styles.discountInput}
            />
          </View>
        </Section>

        <Section title="Pembayaran">
          <View accessibilityRole="radiogroup" style={styles.payments}>
            {(Object.keys(paymentLabel) as PaymentMethod[]).map((method) => {
              const selected = cart.paymentMethod === method;
              return (
                <Pressable
                  key={method}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => update((current) => setPaymentMethod(current, method))}
                  style={[styles.payment, selected && styles.paymentSelected]}>
                  <Text style={[styles.paymentLabel, selected && { color: color.onPlate }]}>{paymentLabel[method]}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <View style={ui.list}>
          <TotalRow label="Subtotal" value={formatRupiah(summary.subtotal)} />
          {summary.discount > 0 && <TotalRow label="Diskon" value={`−${formatRupiah(summary.discount)}`} />}
        </View>

        {checkout.error && <ErrorNotice message={checkout.error.message} />}
      </ScrollView>
      <View style={styles.footer}>
        <Plate tone={summary.checkoutError ? "danger" : "black"}>
          <View style={styles.totalLine}>
            <Text style={[type.caps, { color: color.onPlate }]}>Total · {paymentLabel[cart.paymentMethod]}</Text>
            {/* The plate stays visible above the keyboard, so it carries the reason checkout is blocked. */}
            {summary.checkoutError ? (
              <Text accessibilityRole="alert" style={styles.blocked}>{summary.checkoutError}</Text>
            ) : (
              <Text style={styles.total} adjustsFontSizeToFit numberOfLines={1}>{formatRupiah(summary.total)}</Text>
            )}
          </View>
        </Plate>
        <Button
          label={checkout.error ? "Coba lagi" : "Selesaikan transaksi"}
          onPress={() => checkout.mutate()}
          loading={checkout.isPending}
          disabled={!!summary.checkoutError}
        />
      </View>
    </SafeAreaView>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={ui.row}>
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
      <Text style={ui.money}>{value}</Text>
    </View>
  );
}

function VehicleRow() {
  const vehicle = useCart((state) => state.cart.vehicle);
  return (
    <Section title={vehicle ? "Kendaraan" : "Kendaraan (opsional)"}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={vehicle ? `Kendaraan ${vehicle.plateNumber ?? "tanpa plat"}, ${vehicle.customerName}. Ubah` : "Pilih atau daftarkan kendaraan"}
        onPress={() => router.push("/kendaraan")}
        style={({ pressed }) => [ui.list, ui.row, pressed && ui.pressed]}>
        {vehicle && <PlateNumber plateNumber={vehicle.plateNumber} />}
        <Text style={[vehicle ? type.body : type.title, { flex: 1 }]} numberOfLines={1}>
          {vehicle ? vehicle.customerName : "Cari atau daftarkan plat"}
        </Text>
        <Icon name={{ ios: "chevron.right", android: "chevron_right" }} size={18} tint={color.textMuted} />
      </Pressable>
    </Section>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  content: { gap: space.xl, padding: space.lg },
  lineTop: { flexDirection: "row", alignItems: "center", gap: space.md },
  discount: {
    minHeight: touch,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: color.plate,
    backgroundColor: color.surface,
  },
  currency: { ...type.figure, fontSize: size.lg, color: color.textMuted },
  discountInput: { ...type.figure, flex: 1, minHeight: touch, fontSize: size.lg },
  payments: { flexDirection: "row", gap: space.sm },
  payment: {
    flex: 1,
    minHeight: touch,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: color.plate,
    backgroundColor: color.surface,
  },
  paymentSelected: { backgroundColor: color.plate },
  paymentLabel: { fontFamily: family.bold, fontSize: size.md, color: color.plate },
  totalLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  total: { ...type.figure, fontSize: size.xxl, color: color.onPlate, flexShrink: 1, textAlign: "right" },
  blocked: { fontFamily: family.bold, fontSize: size.md, color: color.onPlate, flexShrink: 1, textAlign: "right" },
  footer: { gap: space.sm, padding: space.lg, backgroundColor: color.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
});
