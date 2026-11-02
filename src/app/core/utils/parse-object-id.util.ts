/** Parse Server objectId (24 hex chars). */
export function isParseObjectId(value: string | null | undefined): boolean {
  return /^[a-f0-9]{24}$/i.test(String(value || '').trim());
}
