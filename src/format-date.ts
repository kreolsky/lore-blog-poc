// Single date formatter for every page: ISO / YYYY-MM-DD in, "6 октября 2026" out.

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}
