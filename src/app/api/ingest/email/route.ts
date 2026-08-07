import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { enqueueInboundEmail } from "@/lib/ingest/queue";
import { extractEmailAddress, postmarkInboundSchema } from "@/lib/ingest/webhook-schema";

// ============================================================================
// Webhook de Postmark Inbound (M4). Responde rápido: resuelve el usuario por
// ingestAddress, inserta InboundMessage (PENDING) y encola el parseo en
// BullMQ. El request del webhook NO parsea nada (PROJECT.md: "Todo el parseo
// va a una cola"). Idempotente por MessageID (Postmark re-delivers).
//
// [STANDBY] la ingesta necesita Redis (Upstash, REDIS_URL) para encolar; sin
// eso el webhook responde 503 y no graba nada, en vez de romper a medias.
// ============================================================================

export async function POST(request: Request) {
  if (!process.env.REDIS_URL) {
    return NextResponse.json(
      { error: "La ingesta por email está en standby: falta REDIS_URL (Upstash)." },
      { status: 503 },
    );
  }

  const secret = process.env.INGEST_WEBHOOK_SECRET;
  if (secret) {
    const token = request.headers.get("x-ingest-token");
    if (token !== secret) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body no es JSON." }, { status: 400 });
  }

  const parsed = postmarkInboundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const data = parsed.data;

  const recipients = new Set<string>();
  const to = extractEmailAddress(data.To ?? "");
  if (to) recipients.add(to);
  for (const full of data.ToFull) {
    const email = extractEmailAddress(full.Email);
    if (email) recipients.add(email);
  }
  if (recipients.size === 0) {
    return NextResponse.json({ error: "No se pudo resolver el destinatario." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { deletedAt: null, ingestAddress: { in: [...recipients] } },
  });
  if (!user) {
    return NextResponse.json({ error: "Dirección de ingesta desconocida." }, { status: 404 });
  }

  const sourceRef = data.MessageID;
  const existing = await prisma.inboundMessage.findUnique({
    where: { userId_sourceRef: { userId: user.id, sourceRef } },
  });
  if (existing) {
    // Postmark reintentó el delivery — ya lo vimos, no encolamos de nuevo.
    return NextResponse.json({ ok: true, processed: false });
  }

  const message = await prisma.inboundMessage.create({
    data: {
      userId: user.id,
      receivedAt: safeDate(data.Date),
      fromAddress: data.From,
      subject: data.Subject ?? null,
      rawBody: data.TextBody ?? data.HtmlBody ?? "",
      sourceRef,
    },
  });

  await enqueueInboundEmail({ inboundMessageId: message.id, userId: user.id });

  return NextResponse.json({ ok: true, inboundMessageId: message.id }, { status: 202 });
}

function safeDate(raw: string | undefined): Date {
  if (!raw) return new Date();
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
