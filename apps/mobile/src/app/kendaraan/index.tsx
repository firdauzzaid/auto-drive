import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Fragment, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { apiRequest, type Vehicle } from "@/api";
import { setVehicle, type CartVehicle } from "@/cart";
import { useCart } from "@/cart-store";
import { Button, ErrorNotice, Field, Icon, PlateNumber, SearchField, Section, styles as ui } from "@/components";
import { useSession } from "@/session";
import { color, space, type } from "@/theme";

// Vehicle first, as in the workshop flow: find the plate, or register it on the spot. Always skippable.
export default function KendaraanScreen() {
  const session = useSession((state) => state.session);
  const { cart, update } = useCart();
  const [plate, setPlate] = useState("");
  // The API matches whole plates only, so search runs on submit instead of on every keystroke.
  const [submitted, setSubmitted] = useState("");
  const normalized = submitted.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const vehicles = useQuery({
    queryKey: ["vehicles", normalized],
    queryFn: () => apiRequest<Vehicle[]>(session, `/vehicles?plate=${encodeURIComponent(normalized)}`),
    enabled: normalized.length >= 2,
  });

  const choose = (vehicle: CartVehicle) => {
    update((current) => setVehicle(current, vehicle));
    router.back();
  };
  const search = () => setSubmitted(plate.trim());

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {cart.vehicle && (
        <Section title="Kendaraan dipilih">
          <View style={[ui.list, ui.row]}>
            <PlateNumber plateNumber={cart.vehicle.plateNumber} />
            <Text style={[type.title, { flex: 1 }]} numberOfLines={2}>{cart.vehicle.customerName}</Text>
          </View>
          <Button
            label="Lihat riwayat servis"
            variant="secondary"
            onPress={() => router.push({ pathname: "/kendaraan/[id]", params: { id: cart.vehicle!.id, plate: cart.vehicle!.plateNumber ?? "", name: cart.vehicle!.customerName } })}
          />
          <Button label="Lepas dari transaksi" variant="danger" onPress={() => { update((current) => setVehicle(current, null)); router.back(); }} />
        </Section>
      )}

      <Section title={cart.vehicle ? "Ganti kendaraan" : "Cari plat nomor"}>
        <View style={styles.searchOnGround}>
          <SearchField
            value={plate}
            onChangeText={setPlate}
            onSubmitEditing={search}
            autoFocus={!cart.vehicle}
            placeholder="Plat lengkap, mis. B 1234 XYZ"
            autoCapitalize="characters"
          />
        </View>
        <Button label="Cari" variant="secondary" onPress={search} loading={vehicles.isFetching} disabled={plate.replace(/[^A-Za-z0-9]/g, "").length < 2} />
      </Section>

      {vehicles.error && <ErrorNotice message={vehicles.error.message} onRetry={() => vehicles.refetch()} />}
      {vehicles.data && vehicles.data.length > 0 && (
        <View style={ui.list}>
          {vehicles.data.map((vehicle, index) => (
            <Fragment key={vehicle.id}>
              {index > 0 && <View style={ui.divider} />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Pilih kendaraan ${vehicle.plateNumber ?? "tanpa plat"} milik ${vehicle.customerName}`}
                onPress={() => choose(vehicle)}
                style={({ pressed }) => [ui.row, pressed && ui.pressed]}>
                <PlateNumber plateNumber={vehicle.plateNumber} />
                <View style={{ flex: 1, gap: space.xs }}>
                  <Text style={type.title} numberOfLines={1}>{vehicle.customerName}</Text>
                  {(vehicle.brand || vehicle.model) && <Text style={type.muted} numberOfLines={1}>{[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}</Text>}
                </View>
                <Icon name={{ ios: "chevron.right", android: "chevron_right" }} size={18} tint={color.textMuted} />
              </Pressable>
            </Fragment>
          ))}
        </View>
      )}
      {vehicles.data && vehicles.data.length === 0 && <RegisterVehicle key={normalized} plate={submitted} onDone={choose} />}
    </ScrollView>
  );
}

function RegisterVehicle({ plate, onDone }: { plate: string; onDone: (vehicle: CartVehicle) => void }) {
  const session = useSession((state) => state.session);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const plateNumber = plate.toUpperCase().replace(/\s+/g, " ");
  // A retry after the vehicle step fails must not create a second customer.
  const customerId = useRef<string | null>(null);
  const editCustomer = (set: (value: string) => void) => (value: string) => { customerId.current = null; set(value); };

  const register = useMutation({
    mutationFn: async () => {
      customerId.current ??= (await apiRequest<{ id: string }>(session, "/customers", {
        method: "POST",
        body: { name: name.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) },
      })).id;
      const vehicle = await apiRequest<{ id: string }>(session, "/vehicles", {
        method: "POST",
        body: {
          customerId: customerId.current,
          plateNumber,
          ...(brand.trim() ? { brand: brand.trim() } : {}),
          ...(model.trim() ? { model: model.trim() } : {}),
        },
      });
      return { id: vehicle.id, plateNumber, customerName: name.trim() };
    },
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      onDone(vehicle);
    },
  });

  return (
    <Section title="Daftarkan kendaraan baru">
      <View style={styles.newHead}>
        <PlateNumber plateNumber={plateNumber} large />
        <Text style={[type.muted, { flex: 1 }]}>Plat ini belum terdaftar. Isi nama pemilik, sisanya boleh dikosongkan.</Text>
      </View>
      <Field label="Nama pelanggan" value={name} onChangeText={editCustomer(setName)} placeholder="mis. Pak Budi" autoCapitalize="words" />
      <Field label="Nomor HP (opsional)" value={phone} onChangeText={editCustomer(setPhone)} placeholder="08xx" keyboardType="phone-pad" />
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Field label="Merek (opsional)" value={brand} onChangeText={setBrand} placeholder="Honda" autoCapitalize="words" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Tipe (opsional)" value={model} onChangeText={setModel} placeholder="Vario 125" autoCapitalize="words" />
        </View>
      </View>
      {register.error && <ErrorNotice message={register.error.message} />}
      <Button label="Daftarkan & pilih" onPress={() => register.mutate()} loading={register.isPending} disabled={!name.trim()} />
    </Section>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  content: { gap: space.xl, padding: space.lg, paddingBottom: space.xxl },
  searchOnGround: { borderWidth: 2, borderColor: color.plate, borderRadius: 10 },
  newHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  pair: { flexDirection: "row", gap: space.sm },
});
