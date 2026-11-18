/**
 * Design tokens taken from the refined Stitch export
 * (tailwind theme in the marketplace homepage HTML).
 * Material roles keep their Stitch names.
 */
export const colors = {
  surface: "#f8f9ff",
  surfaceBright: "#f8f9ff",
  surfaceDim: "#cbdbf5",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#eff4ff",
  surfaceContainer: "#e5eeff",
  surfaceContainerHigh: "#dce9ff",
  surfaceContainerHighest: "#d3e4fe",
  onSurface: "#0b1c30",
  onSurfaceVariant: "#45464d",
  primary: "#000000",
  primaryContainer: "#131b2e",
  onPrimary: "#ffffff",
  secondary: "#904d00",
  secondaryContainer: "#fe932c",
  secondaryFixed: "#ffdcc3",
  onSecondary: "#ffffff",
  outline: "#76777d",
  outlineVariant: "#c6c6cd",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  tertiaryFixed: "#6ffbbe",
  onTertiaryFixedVariant: "#005236",
  background: "#f8f9ff",
} as const;

export const fontFamily = "Manrope, ui-sans-serif, system-ui, sans-serif";

export const fontSize = {
  labelSm: { size: "0.75rem", lineHeight: "1rem", weight: 600 },
  labelMd: { size: "0.875rem", lineHeight: "1.25rem", weight: 600 },
  bodySm: { size: "0.875rem", lineHeight: "1.25rem", weight: 400 },
  bodyMd: { size: "1rem", lineHeight: "1.5rem", weight: 400 },
  bodyLg: { size: "1.125rem", lineHeight: "1.75rem", weight: 400 },
  headlineSm: { size: "1.25rem", lineHeight: "1.75rem", weight: 600 },
  headlineMd: { size: "1.5rem", lineHeight: "2rem", weight: 600 },
  headlineLg: { size: "2rem", lineHeight: "2.5rem", weight: 700 },
  display: { size: "3rem", lineHeight: "3.5rem", weight: 800 },
  priceMd: { size: "1.25rem", lineHeight: "1.75rem", weight: 700 },
  priceLg: { size: "1.75rem", lineHeight: "2.25rem", weight: 800 },
} as const;

export const radius = {
  default: "0.25rem",
  lg: "0.5rem",
  xl: "0.75rem",
  full: "9999px",
} as const;

export const space = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2.5rem",
  margin: "3rem",
} as const;
