import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth/require-user";
import { commitmentHorizonEnd } from "@/lib/domain/commitment";
import { listCurrencies } from "@/features/accounts/queries";
import {
  listCommitmentsWithNextOccurrence,
  listTimeline,
} from "@/features/commitments/queries";
import { CommitmentsTimeline } from "@/features/commitments/components/commitments-timeline";

export default async function CommitmentsPage() {
  const userId = await requireUserId();

  const now = new Date();
  const [commitments, months, currencies] = await Promise.all([
    listCommitmentsWithNextOccurrence(userId),
    listTimeline(userId, now, commitmentHorizonEnd(now, 12)),
    listCurrencies(),
  ]);

  const currencyMetaByCode = new Map(
    currencies.map((c) => [c.code, { symbol: c.symbol, decimals: c.decimals }]),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Compromisos</h1>
        <Link href="/commitments/new" className={buttonVariants({ size: "sm" })}>
          Nuevo compromiso
        </Link>
      </div>
      <CommitmentsTimeline
        commitments={commitments}
        months={months}
        currencyMetaByCode={currencyMetaByCode}
      />
    </div>
  );
}
