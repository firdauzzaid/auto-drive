// "Plat Nomor" world (see .impeccable/surfaces/apps-mobile-src-app.md). Change values here, never in screens.
export const color = {
  plate: "#121314",
  onPlate: "#F7F7F2",
  ground: "#E7E6E1",
  surface: "#F7F7F2",
  border: "#CFCDC6",
  textPrimary: "#121314",
  textMuted: "#4A4B48",
  action: "#F4C21B",
  onAction: "#121314",
  success: "#1D6B3A",
  danger: "#C8261E",
  dangerMuted: "#F6DEDB",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12 } as const;

export const size = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32 } as const;

// Custom faces need one family per weight; Android does not synthesise bold.
export const family = {
  medium: "Barlow-Medium",
  semibold: "Barlow-SemiBold",
  bold: "Barlow-Bold",
  figure: "BarlowCondensed-Bold",
  figureSemi: "BarlowCondensed-SemiBold",
} as const;

export const fonts = {
  [family.medium]: require("../assets/fonts/Barlow-Medium.ttf"),
  [family.semibold]: require("../assets/fonts/Barlow-SemiBold.ttf"),
  [family.bold]: require("../assets/fonts/Barlow-Bold.ttf"),
  [family.figure]: require("../assets/fonts/BarlowCondensed-Bold.ttf"),
  [family.figureSemi]: require("../assets/fonts/BarlowCondensed-SemiBold.ttf"),
};

// Material minimum; also satisfies DESIGN.md's 44 px floor.
export const touch = 48;

export const type = {
  body: { fontFamily: family.medium, fontSize: size.md, color: color.textPrimary },
  muted: { fontFamily: family.medium, fontSize: size.sm, color: color.textMuted },
  label: { fontFamily: family.semibold, fontSize: size.sm, color: color.textPrimary },
  title: { fontFamily: family.semibold, fontSize: size.md, color: color.textPrimary },
  heading: { fontFamily: family.bold, fontSize: size.lg, color: color.textPrimary },
  display: { fontFamily: family.bold, fontSize: size.xxl, color: color.onPlate },
  // Every Rupiah figure, stock count and identifier: condensed, tabular, plate-like.
  figure: { fontFamily: family.figure, fontVariant: ["tabular-nums" as const], color: color.textPrimary, letterSpacing: 0.3 },
  caps: { fontFamily: family.figureSemi, fontSize: size.xs, letterSpacing: 1, textTransform: "uppercase" as const },
} as const;
