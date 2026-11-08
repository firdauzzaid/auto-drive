import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Fragment, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiRequest, type Receipt } from "@/api";
import { Badge, Button, ErrorNotice, Field, Plate, styles as ui } from "@/components";
import { formatDateTime, formatRupiah, paymentLabel } from "@/format";
import { keys } from "@/queries";
import { useSession } from "@/session";
import { color, radius, size, space, type } from "@/theme";

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession((state) => state.session);
  const [voiding, setVoiding] = useState(false);
  const receipt = useQuery({
    queryKey: ["receipt", id],
    queryFn: () => apiRequest<Receipt>(session, `/sales/${id}/receipt`),
  });

  if (receipt.isPending) return <ActivityIndicator style={{ marginTop: space.xxl }} color={color.plate} />;
  if (receipt.error) {
    return (
      <View style={styles.content}>
        <ErrorNotice message={receipt.error.message} onRetry={() => receipt.refetch()} />
      </View>
    );
  }

  const sale = receipt.data;
  const isVoid = sale.status === "void";

  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Plate tone="white">
            <Text style={styles.trx}>{sale.transactionNumber}</Text>
          </Plate>
          <Badge label={isVoid ? "Dibatalkan" : "Selesai"} tone={isVoid ? "danger" : "success"} />
        </View>

        <Plate>
          <Text style={[type.caps, { color: color.onPlate }]}>
            Total{sale.payment ? ` · ${paymentLabel[sale.payment.method]}` : ""}
          </Text>
          <Text style={[styles.total, isVoid && styles.struck]} adjustsFontSizeToFit numberOfLines={1}>{formatRupiah(sale.total)}</Text>
          <Text style={[type.caps, { color: color.onPlate }]}>{formatDateTime(sale.completedAt)}</Text>
        </Plate>

        <View style={ui.list}>
          {sale.items.map((item, index) => (
            <Fragment key={`${item.name}-${index}`}>
              {index > 0 && <View style={ui.divider} />}
              <View style={ui.row}>
                <View style={{ flex: 1, gap: space.xs }}>
                  <Text style={type.title}>{item.name}</Text>
                  <Text style={styles.qty}>{item.quantity} × {formatRupiah(item.unitPrice)}</Text>
                </View>
                <Text style={ui.money}>{formatRupiah(item.lineTotal)}</Text>
              </View>
            </Fragment>
          ))}
          <View style={styles.rule} />
          <Line label="Subtotal" value={formatRupiah(sale.subtotal)} />
          {sale.discount > 0 && <Line label="Diskon" value={`−${formatRupiah(sale.discount)}`} />}
        </View>

        <View style={{ gap: space.sm }}>
          <Button label="Transaksi Baru" onPress={() => router.navigate("/kasir")} />
          <Button label="Bagikan bukti" variant="secondary" onPress={() => Share.share({ message: receiptText(sale) })} />
          {session?.role === "owner" && !isVoid && <Button label="Batal Transaksi" variant="danger" onPress={() => setVoiding(true)} />}
        </View>
      </ScrollView>
      <VoidSheet saleId={sale.id} visible={voiding} onClose={() => setVoiding(false)} />
    </SafeAreaView>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={[ui.row, { minHeight: 0, paddingVertical: space.sm }]}>
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
      <Text style={ui.money}>{value}</Text>
    </View>
  );
}

function VoidSheet({ saleId, visible, onClose }: { saleId: string; visible: boolean; onClose: () => void }) {
  const session = useSession((state) => state.session);
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const voidSale = useMutation({
    mutationFn: () => apiRequest(session, `/sales/${saleId}/void`, { method: "POST", body: { reason: reason.trim() } }),
    onSuccess: () => {
      for (const key of [["receipt", saleId], keys.products, keys.dashboard, keys.summary]) queryClient.invalidateQueries({ queryKey: key });
      setReason("");
      onClose();
    },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable accessibilityLabel="Tutup" style={{ flex: 1 }} onPress={onClose} />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <Text accessibilityRole="header" style={type.heading}>Batalkan transaksi ini?</Text>
          <Text style={type.muted}>Stok sparepart akan dikembalikan dan transaksi tercatat sebagai dibatalkan. Tindakan ini tidak bisa diurungkan.</Text>
          <Field label="Alasan pembatalan" value={reason} onChangeText={setReason} placeholder="Mis. salah input jumlah" autoFocus />
          {voidSale.error && <ErrorNotice message={voidSale.error.message} />}
          <Button label="Ya, batalkan transaksi" variant="danger" onPress={() => voidSale.mutate()} loading={voidSale.isPending} disabled={!reason.trim()} />
          <Button label="Kembali" variant="secondary" onPress={onClose} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function receiptText(sale: Receipt) {
  const lines = sale.items.map((item) => `${item.name} ${item.quantity} × ${formatRupiah(item.unitPrice)} = ${formatRupiah(item.lineTotal)}`);
  return [
    `Bukti transaksi ${sale.transactionNumber}`,
    formatDateTime(sale.completedAt),
    ...lines,
    sale.discount > 0 ? `Diskon −${formatRupiah(sale.discount)}` : null,
    `Total ${formatRupiah(sale.total)}${sale.payment ? ` (${paymentLabel[sale.payment.method]})` : ""}`,
    sale.status === "void" ? "Status: DIBATALKAN" : null,
  ].filter(Boolean).join("\n");
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  content: { gap: space.lg, padding: space.lg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  trx: { ...type.figure, fontSize: size.lg, letterSpacing: 1.5 },
  total: { ...type.figure, fontSize: size.xxl, color: color.onPlate, lineHeight: size.xxl + 4 },
  struck: { textDecorationLine: "line-through" },
  qty: { ...type.figure, fontSize: size.sm, color: color.textMuted },
  rule: { height: 2, backgroundColor: color.plate, marginHorizontal: space.lg },
  backdrop: { flex: 1, backgroundColor: "rgba(18, 19, 20, 0.5)" },
  sheet: {
    gap: space.md,
    padding: space.xl,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    backgroundColor: color.surface,
  },
});
