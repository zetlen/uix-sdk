export const GUEST_UI_ID_SUFFIX = "ui";
export const GUEST_SERVER_ID_SUFFIX = "server";
export const ID_CONNECTOR = "-";

type LegalSuffix = typeof GUEST_SERVER_ID_SUFFIX | typeof GUEST_UI_ID_SUFFIX;

export const makeId = (prefix: string, suffix: LegalSuffix) =>
  `${prefix}${ID_CONNECTOR}${suffix}`;
