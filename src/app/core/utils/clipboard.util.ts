export async function copyTextToClipboard(text: string): Promise<boolean> {
  const trimmed = text?.trim();
  if (!trimmed) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(trimmed);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = trimmed;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
