export const baseName = (name: string | null) =>
  (name ?? "Untitled").replace(/\.[^.]+$/, "");