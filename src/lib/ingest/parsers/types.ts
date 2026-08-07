// Los tipos del contrato viven en src/lib/domain/ingest.ts — los parsers
// (capa de ingesta) importan el contrato desde el domain, no al revés.
export type { ParsedItem, ParseResult, Parser, RawEmail } from "@/lib/domain/ingest";
