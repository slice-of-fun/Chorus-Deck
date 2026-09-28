export function filePathToLocalUrl(absPath: string): string {
  const normalized = absPath.replace(/\\/g, '/');
  const encoded = normalized.split('/').map(encodeURIComponent).join('/');
  return `local:///${encoded}`;
}
