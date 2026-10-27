// UI sizing belongs to this browser, separately from project files and diagram zoom.
export const interfaceSizes = [100, 115, 130, 150] as const;
export type InterfaceSize = (typeof interfaceSizes)[number];
const storageKey = "signalpath-interface-size";
export function readInterfaceSize(): InterfaceSize {
  try {
    const value = Number(localStorage.getItem(storageKey));
    return interfaceSizes.includes(value as InterfaceSize)
      ? (value as InterfaceSize)
      : 100;
  } catch {
    return 100;
  }
}
export function rememberInterfaceSize(size: InterfaceSize): void {
  try {
    localStorage.setItem(storageKey, String(size));
  } catch {
    /* Sizing still works if browser storage is unavailable. */
  }
}
