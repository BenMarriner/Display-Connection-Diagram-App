import type { Capabilities, Port } from "./model";

/** RGB at 8 bpc is the interoperable baseline; optional formats/depths stay unverified. */
export function prefillTemplatePort(port: Port): Port {
  return {
    ...port,
    caps: {
      ...port.caps,
      ...(port.caps.depths === null ? { depths: [8], depthsComplete: false } : {}),
      ...(port.caps.formats === null ? { formats: ["RGB"] as Capabilities["formats"], formatsComplete: false } : {}),
    },
  };
}

/** Fill missing facts without replacing an entered limit or enabling a source feature. */
export function fillMissingPortSpecs(port: Port, reference?: Port): Port {
  const result = prefillTemplatePort(structuredClone(port));
  if (!reference || reference.connector !== port.connector || reference.protocol !== port.protocol) return result;
  const current = result.caps, verified = reference.caps;
  if (!current.version) current.version = verified.version;
  if (current.link === "unknown") current.link = verified.link;
  for (const field of ["hdr", "vrr", "dsc"] as const)
    if (current[field] === "unknown") current[field] = verified[field];
  for (const field of ["vrrMin", "vrrMax"] as const)
    if (current[field] === null) current[field] = verified[field];
  for (const [field, complete] of [["modes", "modesComplete"], ["depths", "depthsComplete"], ["formats", "formatsComplete"]] as const) {
    if (verified[field] === null) continue;
    if (port.caps[field] === null) {
      Object.assign(current, { [field]: structuredClone(verified[field]), [complete]: verified[complete] });
    } else if (current[complete] === false) {
      Object.assign(current, { [field]: [...new Set([...(current[field] ?? []), ...verified[field]])] });
    }
  }
  return result;
}
