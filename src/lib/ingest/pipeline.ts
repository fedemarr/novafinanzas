import { prisma } from "@/lib/db/prisma";
import { itemDedupeHash, itemToMoney } from "@/lib/domain/ingest";
import { parseEmail } from "./parsers/registry";
import { Prisma } from "@/generated/prisma/client";

// ============================================================================
// Pipeline de ingesta: InboundMessage → parser → transacción PENDING_REVIEW.
// Lo usa el Worker de BullMQ y el smoke end-to-end. NUNCA se inventa un
// monto: ante cualquier dato faltante o ambiguo, el mensaje queda FAILED con
// errorDetail para revisión manual.
//
// M4 = mails de UNA operación. Los resúmenes con varias operaciones (que
// además disparan el matching ±1 día contra lo que ya entró) son M5.
// ============================================================================

export interface ProcessedResult {
  parseStatus: "PARSED" | "IGNORED" | "FAILED";
  transactionId: string | null;
  errorDetail: string | null;
}

export async function processInboundMessage(
  userId: string,
  inboundMessageId: string,
): Promise<ProcessedResult> {
  const message = await prisma.inboundMessage.findFirst({
    where: { id: inboundMessageId, userId, deletedAt: null },
  });
  if (!message) {
    throw new Error(`InboundMessage ${inboundMessageId} no encontrada para este usuario.`);
  }

  if (message.parseStatus !== "PENDING") {
    return {
      parseStatus: message.parseStatus,
      transactionId: message.transactionId,
      errorDetail: message.errorDetail,
    };
  }

  const parsed = parseEmail({
    fromAddress: message.fromAddress,
    subject: message.subject ?? "",
    textBody: message.rawBody,
  });

  if (!parsed) {
    return mark(message.id, "FAILED", null, "No se reconoció el remitente ni el formato del mail.");
  }
  if (parsed.items.length !== 1) {
    return mark(
      message.id,
      "FAILED",
      null,
      "El mail trae más de una operación — los resúmenes se importan en M5.",
    );
  }

  const item = parsed.items[0];

  let amount;
  try {
    amount = itemToMoney(item);
  } catch {
    return mark(message.id, "FAILED", null, "El mail no tiene un monto válido.");
  }

  const currency = await prisma.currency.findUnique({ where: { code: amount.currency } });
  if (!currency) {
    return mark(message.id, "FAILED", null, `Moneda desconocida: ${amount.currency}.`);
  }

  const account = await prisma.account.findFirst({
    where: { userId, deletedAt: null, institutionKey: parsed.parserKey },
  });
  if (!account) {
    return mark(
      message.id,
      "FAILED",
      null,
      `No hay cuenta con institución "${parsed.parserKey}". Creala y tipeá esa institución.`,
    );
  }

  const occurredAt = item.occurredAt ?? message.receivedAt;
  const dedupeHash = itemDedupeHash(item, { userId, accountId: account.id });

  const existing = await prisma.transaction.findFirst({ where: { userId, dedupeHash } });
  if (existing) {
    return mark(message.id, "IGNORED", null, "Duplicado: mismo monto, cuenta y día.");
  }

  try {
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        accountId: account.id,
        type: item.type,
        amount: amount.amount.toString(),
        currencyCode: amount.currency,
        occurredAt,
        description: item.description,
        merchantRaw: item.merchantRaw,
        merchantNormalized: item.merchantNormalized,
        status: "PENDING_REVIEW",
        source: "EMAIL",
        sourceRef: message.sourceRef,
        dedupeHash,
      },
    });

    await prisma.inboundMessage.update({
      where: { id: message.id },
      data: {
        parseStatus: "PARSED",
        parserKey: parsed.parserKey,
        transactionId: transaction.id,
        errorDetail: null,
      },
    });

    return { parseStatus: "PARSED", transactionId: transaction.id, errorDetail: null };
  } catch (err) {
    if (isDedupeCollision(err)) {
      return mark(message.id, "IGNORED", null, "Duplicado: mismo monto, cuenta y día.");
    }
    throw err;
  }
}

function mark(
  messageId: string,
  parseStatus: ProcessedResult["parseStatus"],
  transactionId: string | null,
  errorDetail: string | null,
): Promise<ProcessedResult> {
  return prisma.inboundMessage
    .update({
      where: { id: messageId },
      data: { parseStatus, transactionId, errorDetail },
    })
    .then(() => ({ parseStatus, transactionId, errorDetail }));
}

function isDedupeCollision(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== "P2002") return false;
  const target = err.meta?.target;
  const targets = Array.isArray(target) ? target.map(String) : [String(target)];
  return targets.some((t) => t.toLowerCase().includes("dedupe"));
}
