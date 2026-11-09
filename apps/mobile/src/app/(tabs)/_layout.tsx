import { NativeTabs } from "expo-router/native-tabs";

import { color, family, size } from "@/theme";

export default function TabsLayout() {
  return (
    <NativeTabs
      backgroundColor={color.surface}
      indicatorColor={color.ground}
      labelVisibilityMode="labeled"
      iconColor={{ default: color.textMuted, selected: color.plate }}
      labelStyle={{
        default: { color: color.textMuted, fontFamily: family.semibold, fontSize: size.xs },
        selected: { color: color.plate, fontFamily: family.bold, fontSize: size.xs },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="kasir">
        <NativeTabs.Trigger.Label>Kasir</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "cart", selected: "cart.fill" }} md="point_of_sale" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stok">
        <NativeTabs.Trigger.Label>Stok</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "shippingbox", selected: "shippingbox.fill" }} md="inventory_2" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="lainnya">
        <NativeTabs.Trigger.Label>Lainnya</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ellipsis.circle" md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
