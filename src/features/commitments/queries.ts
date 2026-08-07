import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { money, type Money } from "@/lib/domain/money";
import type { CommitmentKind } from "@/lib/domain/commitment";

/** Compromiso activo + su próxima cuota vencida o por vencer. */
export interface CommitmentWithNextOccurrence {
  id: string;
  kind: CommitmentKind;
  name: string;
  currencyCode: string;
  account: { id: string; name: string; currencyCode: string };
  totalAmount: Decimal;
  startDate: Date;
  endDate: Date | null;
  recurrenceRule: string | null;
  isActive: boolean;
  nextOccurrence: {
    id: string;
    dueDate: Date;
    amount: Decimal;
    installmentNumber: number | null;
    installmentTotal: number | null;
  } | null;
  remainingOccurrences: number;
}

export async function listCommitmentsWithNextOccurrence(
  userId: string,
): Promise<CommitmentWithNextOccurrence[]> {
  const commitments = await prisma.commitment.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { account: { select: { id: true, name: true, currencyCode: true } } },
  });

  const now = new Date();

  return Promise.all(
    commitments.map(async (commitment) => {
      const future = await prisma.commitmentOccurrence.findMany({
        where: {
          commitmentId: commitment.id,
          deletedAt: null,
          dueDate: { gte: now },
        },
        orderBy: { dueDate: "asc" },
        select: {
          id: true,
          dueDate: true,
          amount: true,
          installmentNumber: true,
          installmentTotal: true,
        },
      });

      return {
        id: commitment.id,
        kind: commitment.kind,
        name: commitment.name,
        currencyCode: commitment.currencyCode,
        account: commitment.account,
        totalAmount: commitment.totalAmount,
        startDate: commitment.startDate,
        endDate: commitment.endDate,
        recurrenceRule: commitment.recurrenceRule,
        isActive: commitment.isActive,
        nextOccurrence: future[0] ?? null,
        remainingOccurrences: future.length,
      };
    }),
  );
}

/** Una ocurrencia dentro de la ventana del timeline, ya agrupada. */
export interface TimelineOccurrence {
  id: string;
  dueDate: Date;
  amount: Decimal;
  currencyCode: string;
  status: string;
  commitment: {
    id: string;
    name: string;
    kind: CommitmentKind;
    account: { id: string; name: string };
  };
}

export interface TimelineMonth {
  /** Clave YYYY-MM (UTC) — el componente formatea el label. */
  key: string;
  /** Totales por moneda del mes. Nunca se suman monedas distintas (invariante). */
  totals: Money[];
  entries: TimelineOccurrence[];
}

export async function listTimeline(userId: string, from: Date, to: Date): Promise<TimelineMonth[]> {
  const occurrences = await prisma.commitmentOccurrence.findMany({
    where: {
      commitment: { userId, deletedAt: null },
      deletedAt: null,
      dueDate: { gte: from, lte: to },
    },
    orderBy: [{ dueDate: "asc" }, { commitmentId: "asc" }],
    include: {
      commitment: {
        select: {
          id: true,
          name: true,
          kind: true,
          account: { select: { id: true, name: true } },
        },
      },
    },
  });

  const byMonth = new Map<string, TimelineMonth>();
  for (const occ of occurrences) {
    const key = monthKey(occ.dueDate);
    let month = byMonth.get(key);
    if (!month) {
      month = { key, totals: [], entries: [] };
      byMonth.set(key, month);
    }
    month.entries.push({
      id: occ.id,
      dueDate: occ.dueDate,
      amount: occ.amount,
      currencyCode: occ.currencyCode,
      status: occ.status,
      commitment: {
        id: occ.commitment.id,
        name: occ.commitment.name,
        kind: occ.commitment.kind,
        account: occ.commitment.account,
      },
    });
  }

  for (const month of byMonth.values()) {
    month.totals = sumByCurrency(month.entries);
  }

  return [...byMonth.values()];
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sumByCurrency(entries: TimelineOccurrence[]): Money[] {
  const sums = new Map<string, Decimal>();
  for (const entry of entries) {
    const current = sums.get(entry.currencyCode) ?? new Decimal(0);
    sums.set(entry.currencyCode, current.plus(entry.amount));
  }
  return [...sums.entries()].map(([currencyCode, amount]) => money(amount, currencyCode));
}
