// Helpers para recordatorios por WhatsApp con enlaces wa.me (sin API ni backend).

/**
 * Normaliza un teléfono colombiano al formato internacional que espera wa.me
 * (solo dígitos, con indicativo 57 y sin '+'). Devuelve null si no es usable.
 */
export function normalizarTelefonoCO(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  const digitos = telefono.replace(/\D/g, '')
  if (digitos.length === 0) return null
  if (digitos.length === 10) return `57${digitos}` // celular nacional
  if (digitos.length === 12 && digitos.startsWith('57')) return digitos
  return digitos // otros casos: se usa tal cual (mejor esfuerzo)
}

/**
 * Arma la URL de WhatsApp para un teléfono y un mensaje. Devuelve null si el
 * teléfono no sirve (para deshabilitar el botón).
 */
export function enlaceWhatsApp(telefono: string | null | undefined, mensaje: string): string | null {
  const numero = normalizarTelefonoCO(telefono)
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}
