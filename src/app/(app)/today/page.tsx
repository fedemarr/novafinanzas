import { requireUserId } from "@/lib/auth/require-user";
import { listCurrencies } from "@/features/accounts/queries";
import { getTodayView } from "@/features/today/queries";
import { TodayViewComponent } from "@/features/today/components/today-view";

export default async function TodayPage() {
  const userId = await requireUserId();
  const [view, currencies] = await Promise.all([getTodayView(userId), listCurrencies()]);

  const currencyMetaByCode = new Map(
    currencies.map((c) => [c.code, { symbol: c.symbol, decimals: c.decimals }]),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-lg font-semibold">Hoy</h1>
      <TodayViewComponent view={view} currencyMetaByCode={currencyMetaByCode} />
    </div>
  );
}
