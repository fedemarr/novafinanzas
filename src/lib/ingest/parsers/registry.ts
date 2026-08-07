import type { ParseResult, Parser, RawEmail } from "./types";
import { parseMercadoPago } from "./mercadopago";

// ============================================================================
// Registry de parsers. El orden importa: se prueba de arriba hacia abajo y
// gana el primero que reconoce el mail. parserKey es la clave que el usuario
// tipea en el campo "Institución" de la cuenta (Account.institutionKey) —
// la transacción aterriza en la cuenta con institutionKey === parserKey.
// ============================================================================

interface RegisteredParser {
  key: string;
  name: string;
  parse: Parser;
}

export const PARSERS: RegisteredParser[] = [
  { key: "mercadopago", name: "Mercado Pago", parse: parseMercadoPago },
];

/** Para el campo "Institución" de cuentas (datalist de keys conocidas). */
export function knownParserKeys(): string[] {
  return PARSERS.map((p) => p.key);
}

export function parserNameByKey(key: string): string | null {
  return PARSERS.find((p) => p.key === key)?.name ?? null;
}

/**
 * Prueba cada parser hasta que uno reconoce el mail. Devuelve null si
 * ninguno lo parsea (el pipeline marca FAILED — nunca se inventa un monto).
 */
export function parseEmail(email: RawEmail): ParseResult | null {
  for (const parser of PARSERS) {
    const result = parser.parse(email);
    if (result) return result;
  }
  return null;
}
