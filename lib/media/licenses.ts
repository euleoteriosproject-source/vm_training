import type { LicenseCode, LicenseInfo } from "./types";

const licenses: Record<LicenseCode, LicenseInfo> = {
  PD: {
    code: "PD",
    name: "Public Domain",
    url: "https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Public_domain",
    attributionRequired: false,
    shareAlike: false,
    sourceType: "public_domain",
  },
  "CC0-1.0": {
    code: "CC0-1.0",
    name: "CC0 1.0",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
    attributionRequired: false,
    shareAlike: false,
    sourceType: "public_domain",
  },
  "CC-BY-3.0": {
    code: "CC-BY-3.0",
    name: "CC BY 3.0",
    url: "https://creativecommons.org/licenses/by/3.0/",
    attributionRequired: true,
    shareAlike: false,
    sourceType: "creative_commons",
  },
  "CC-BY-4.0": {
    code: "CC-BY-4.0",
    name: "CC BY 4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
    attributionRequired: true,
    shareAlike: false,
    sourceType: "creative_commons",
  },
  "CC-BY-SA-3.0": {
    code: "CC-BY-SA-3.0",
    name: "CC BY-SA 3.0",
    url: "https://creativecommons.org/licenses/by-sa/3.0/",
    attributionRequired: true,
    shareAlike: true,
    sourceType: "creative_commons",
  },
  "CC-BY-SA-4.0": {
    code: "CC-BY-SA-4.0",
    name: "CC BY-SA 4.0",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
    attributionRequired: true,
    shareAlike: true,
    sourceType: "creative_commons",
  },
  "VITAL-FREE-PACK": {
    code: "VITAL-FREE-PACK",
    name: "Vital Animations Free Pack",
    url: null,
    attributionRequired: true,
    shareAlike: false,
    sourceType: "licensed_pack",
  },
  CUSTOM: {
    code: "CUSTOM",
    name: "Custom / self-produced",
    url: null,
    attributionRequired: false,
    shareAlike: false,
    sourceType: "self_produced",
  },
};

function normalized(value: string) {
  return value
    .toUpperCase()
    .replaceAll("CREATIVE COMMONS", "CC")
    .replaceAll("ATTRIBUTION", "BY")
    .replaceAll("SHAREALIKE", "SA")
    .replace(/[_.]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveLicense(
  rawName: string,
  rawUrl = "",
): LicenseInfo | null {
  const value = `${normalized(rawName)} ${normalized(rawUrl)}`;
  if (/PUBLIC DOMAIN|PUBLICDOMAIN/.test(value)) return licenses.PD;
  if (/CC0|ZERO\/1-0/.test(value)) return licenses["CC0-1.0"];
  if (/BY-SA[^0-9]*4-0|BY-SA 4-0/.test(value)) return licenses["CC-BY-SA-4.0"];
  if (/BY-SA[^0-9]*3-0|BY-SA 3-0/.test(value)) return licenses["CC-BY-SA-3.0"];
  if (/BY[^A-Z0-9]*4-0|BY 4-0/.test(value)) return licenses["CC-BY-4.0"];
  if (/BY[^A-Z0-9]*3-0|BY 3-0/.test(value)) return licenses["CC-BY-3.0"];
  return null;
}

export function getLicense(code: LicenseCode) {
  return licenses[code];
}

export function buildAttribution(input: {
  title: string;
  author?: string | null;
  sourceName: string;
  license: LicenseInfo;
}) {
  const author = input.author?.trim() || "Autor não informado";
  if (input.license.code === "PD")
    return `“${input.title}”. Fonte: ${input.sourceName}. Licença: Public Domain.`;
  return `“${input.title}”. Autor: ${author}. Licença: ${input.license.name}. Fonte: ${input.sourceName}.`;
}
