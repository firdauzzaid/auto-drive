import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { color, family, radius, size, space, touch, type } from "./theme";

export function Icon({ name, size: iconSize = 22, tint = color.textPrimary }: { name: SymbolViewProps["name"]; size?: number; tint?: string }) {
  return <SymbolView name={name} size={iconSize} tintColor={tint} />;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
};

const buttonTone = {
  primary: { background: color.action, border: color.action, text: color.onAction },
  secondary: { background: color.surface, border: color.plate, text: color.plate },
  danger: { background: color.surface, border: color.danger, text: color.danger },
};

export function Button({ label, onPress, variant = "primary", disabled, loading }: ButtonProps) {
  const inactive = disabled || loading;
  const tone = buttonTone[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: tone.background, borderColor: tone.border },
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}>
      {loading ? <ActivityIndicator color={tone.text} /> : <Text style={[styles.buttonLabel, { color: tone.text }]}>{label}</Text>}
    </Pressable>
  );
}

// The signature move: figures and identifiers stamped as a licence plate with an inset rule.
export function Plate({ children, tone = "black", style }: { children: ReactNode; tone?: "black" | "white" | "danger"; style?: StyleProp<ViewStyle> }) {
  const ground = tone === "white" ? color.surface : tone === "danger" ? color.danger : color.plate;
  return (
    <View style={[styles.plate, { backgroundColor: ground, borderColor: tone === "danger" ? color.danger : color.plate }, style]}>
      <View style={[styles.plateRule, { borderColor: tone === "white" ? color.plate : color.onPlate }]}>{children}</View>
    </View>
  );
}

// A vehicle is always shown as its own white plate, the way it is read at the counter.
export function PlateNumber({ plateNumber, large }: { plateNumber: string | null; large?: boolean }) {
  return (
    <Plate tone="white">
      <Text style={[styles.plateNumber, large && { fontSize: size.xl }]}>{plateNumber ?? "TANPA PLAT"}</Text>
    </Plate>
  );
}

// Black shell band at the top of every tab; the screen's identity lives here.
export function Band({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <SafeAreaView edges={["top"]} style={styles.band}>
      <View style={styles.bandHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text accessibilityRole="header" style={styles.bandTitle}>{title}</Text>
          {subtitle && <Text style={styles.bandSubtitle}>{subtitle}</Text>}
        </View>
        {action}
      </View>
      {children}
    </SafeAreaView>
  );
}

export function SearchField(props: Pick<TextInputProps, "value" | "onChangeText" | "placeholder" | "autoCapitalize" | "autoFocus" | "onSubmitEditing">) {
  return (
    <View style={styles.search}>
      <Icon name={{ ios: "magnifyingglass", android: "search" }} size={20} tint={color.textMuted} />
      <TextInput
        {...props}
        accessibilityLabel={props.placeholder}
        placeholderTextColor={color.textMuted}
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={styles.searchInput}
      />
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={type.label}>{label}</Text>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor={color.textMuted} style={styles.field} />
    </View>
  );
}

export function Stepper({ quantity, onChange, max, label }: { quantity: number; onChange: (next: number) => void; max?: number; label: string }) {
  const atMax = max !== undefined && quantity >= max;
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={quantity === 1 ? `Hapus ${label}` : `Kurangi ${label}`}
        onPress={() => onChange(quantity - 1)}
        style={({ pressed }) => [styles.stepperKey, quantity === 1 && { borderColor: color.danger }, pressed && styles.pressed]}>
        <Icon name={quantity === 1 ? { ios: "trash", android: "delete" } : { ios: "minus", android: "remove" }} tint={quantity === 1 ? color.danger : color.plate} />
      </Pressable>
      <Text style={styles.stepperValue} accessibilityLabel={`Jumlah ${quantity}`}>{quantity}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={atMax ? `${label} sudah mencapai stok` : `Tambah ${label}`}
        accessibilityState={{ disabled: atMax }}
        disabled={atMax}
        onPress={() => onChange(quantity + 1)}
        style={({ pressed }) => [styles.stepperKey, styles.stepperAdd, atMax && styles.inactive, pressed && styles.pressed]}>
        <Icon name={{ ios: "plus", android: "add" }} tint={color.onPlate} />
      </Pressable>
    </View>
  );
}

// Fixed state marks: outline = information, red outline = menipis, red fill = habis/dibatalkan, green fill = selesai.
const badgeTone = {
  neutral: { background: "transparent", border: color.plate, text: color.plate },
  warning: { background: "transparent", border: color.danger, text: color.danger },
  danger: { background: color.danger, border: color.danger, text: color.onPlate },
  success: { background: color.success, border: color.success, text: color.onPlate },
};

export function Badge({ label, tone = "neutral" }: { label: string; tone?: keyof typeof badgeTone }) {
  const t = badgeTone[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.background, borderColor: t.border }]}>
      <Text style={[type.caps, { color: t.text }]}>{label}</Text>
    </View>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" style={styles.error}>
      <Icon name={{ ios: "exclamationmark.triangle.fill", android: "warning" }} size={20} tint={color.danger} />
      <View style={{ flex: 1, gap: space.sm }}>
        <Text style={styles.errorText}>{message}</Text>
        {onRetry && <Button label="Coba lagi" variant="secondary" onPress={onRetry} />}
      </View>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={[type.title, { textAlign: "center" }]}>{title}</Text>
      {body && <Text style={[type.muted, { textAlign: "center" }]}>{body}</Text>}
    </View>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export const styles = StyleSheet.create({
  button: {
    minHeight: touch + 4,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: { fontFamily: family.bold, fontSize: size.lg },
  inactive: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  plate: { borderRadius: radius.md, borderWidth: 2, padding: 4 },
  plateRule: { borderWidth: 2, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  band: { backgroundColor: color.plate, paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  plateNumber: { ...type.figure, fontSize: size.md, letterSpacing: 1.5 },
  bandHead: { flexDirection: "row", alignItems: "flex-end", gap: space.md },
  bandTitle: { fontFamily: family.bold, fontSize: size.xl, color: color.onPlate, paddingTop: space.sm },
  bandSubtitle: { fontFamily: family.medium, fontSize: size.sm, color: color.onPlate },
  search: {
    minHeight: touch,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
  },
  searchInput: { flex: 1, minHeight: touch, fontFamily: family.medium, fontSize: size.md, color: color.textPrimary },
  field: {
    minHeight: touch,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: color.plate,
    backgroundColor: color.surface,
    fontFamily: family.medium,
    fontSize: size.md,
    color: color.textPrimary,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.xs },
  stepperKey: {
    width: touch,
    height: touch,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: color.plate,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperAdd: { backgroundColor: color.plate },
  stepperValue: { ...type.figure, minWidth: 32, textAlign: "center", fontSize: size.xl },
  badge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1.5 },
  error: { flexDirection: "row", gap: space.sm, padding: space.md, borderRadius: radius.sm, backgroundColor: color.dangerMuted },
  errorText: { fontFamily: family.semibold, fontSize: size.sm, color: color.danger },
  empty: { paddingVertical: space.xl, paddingHorizontal: space.lg, alignItems: "center", gap: space.xs },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { ...type.caps, fontSize: size.sm, color: color.textMuted },
  row: {
    minHeight: touch,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: color.surface,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.border, marginLeft: space.lg },
  list: { borderRadius: radius.md, overflow: "hidden", backgroundColor: color.surface },
  title: type.title,
  muted: type.muted,
  money: { ...type.figure, fontSize: size.lg, textAlign: "right" },
});
