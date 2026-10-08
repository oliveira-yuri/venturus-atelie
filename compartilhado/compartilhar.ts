/** Link de compartilhamento pelo WhatsApp — o que vale quando não há `navigator.share`. */
export function linkDoWhatsApp(titulo: string, enderecoAbsoluto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${titulo} — ${enderecoAbsoluto}`)}`;
}
