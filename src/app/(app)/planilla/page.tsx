import Link from "next/link";
import { X } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/require-user";
import { listCurrencies } from "@/features/accounts/queries";
import { listCategoriesForSelect } from "@/features/transactions/queries";
import {
  getMonthlyTotals,
  getPlanilla,
  monthKeyToString,
  parseMonthKey,
} from "@/features/planilla/queries";
import { buildPlanillaChartData } from "@/features/planilla/chart-data";
import { QuickEntryForm } from "@/features/planilla/components/quick-entry-form";
import { MonthGrid } from "@/features/planilla/components/month-grid";
import { MonthSummary } from "@/features/planilla/components/month-summary";
import { CategoryDonut } from "@/features/planilla/components/charts/category-donut";
import { DailyBars } from "@/features/planilla/components/charts/daily-bars";
import { MonthlyTrend } from "@/features/planilla/components/charts/monthly-trend";

export default async function PlanillaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; moneda?: string; cat?: string }>;
}) {
  const sp = await searchParams;
  const userId = await requireUserId();

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const key = parseMonthKey(sp.mes, user.timezone);
  const currencyCode =
    sp.moneda === "USD" ? "USD" : sp.moneda === "ARS" ? "ARS" : user.baseCurrencyCode;
  const rawFilter = sp.cat;

  const [currencies, categories, planilla, trend] = await Promise.all([
    listCurrencies(),
    listCategoriesForSelect(),
    getPlanilla(userId, key, currencyCode, user.timezone),
    getMonthlyTotals(userId, currencyCode, user.timezone, key, 6),
  ]);

  const currencyMetaByCode = new Map(
    currencies.map((c) => [c.code, { symbol: c.symbol, decimals: c.decimals }]),
  );
  const currencyMeta = currencyMetaByCode.get(currencyCode) ?? { symbol: currencyCode, decimals: 2 };

  const filterCategoryId = planilla.categories.some((c) => c.id === rawFilter)
    ? rawFilter!
    : null;

  const chartData = buildPlanillaChartData(
    planilla,
    trend,
    currencyMeta.symbol,
    currencyMeta.decimals,
  );

  const monthKey = monthKeyToString(key);
  const baseQuery = `mes=${monthKey}&moneda=${currencyCode}`;
  const filterHref = (categoryId: string | null) =>
    `/planilla?${baseQuery}${categoryId ? `&cat=${encodeURIComponent(categoryId)}` : ""}`;
  const monthHref = (k: string) => `/planilla?mes=${k}&moneda=${currencyCode}`;
  const monthLink = (offset: number) => {
    const next = new Date(Date.UTC(key.year, key.month - 1 + offset, 1));
    const y = next.getUTCFullYear();
    const m = next.getUTCMonth() + 1;
    return `/planilla?mes=${y}-${String(m).padStart(2, "0")}&moneda=${currencyCode}`;
  };

  const quickAccounts = await prisma.account.findMany({
    where: { userId, deletedAt: null, isActive: true, isSavings: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, currencyCode: true },
  });

  const chartCard =
    "rounded-xl border bg-card p-4 ring-1 ring-foreground/5";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={monthLink(-1)}
            className="flex size-8 items-center justify-center rounded-md border hover:bg-muted"
            aria-label="Mes anterior"
          >
            ‹
          </Link>
          <h1 className="text-lg font-semibold">{planilla.label}</h1>
          <Link
            href={monthLink(1)}
            className="flex size-8 items-center justify-center rounded-md border hover:bg-muted"
            aria-label="Mes siguiente"
          >
            ›
          </Link>
        </div>

        <div className="flex overflow-hidden rounded-md border text-sm">
          {["ARS", "USD"].map((cur) => (
            <Link
              key={cur}
              href={`/planilla?${baseQuery}&moneda=${cur}`}
              className={
                "px-3 py-1.5 " +
                (cur === currencyCode
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted")
              }
            >
              {cur}
            </Link>
          ))}
        </div>
      </div>

      <MonthSummary planilla={planilla} currencyMeta={currencyMeta} />

      {planilla.availableCurrencies.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          Este mes también hay movimientos en{" "}
          {planilla.availableCurrencies.filter((c) => c !== currencyCode).join(", ")} — usá el
          toggle para verlos.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={chartCard}>
          <h2 className="mb-3 text-sm font-medium">Gastos por categoría</h2>
          <CategoryDonut
            data={chartData}
            selectedCategoryId={filterCategoryId}
            filterHref={filterHref}
          />
        </div>
        <div className={chartCard}>
          <h2 className="mb-3 text-sm font-medium">Gastos por día</h2>
          <DailyBars data={chartData} />
        </div>
      </div>

      <div className={chartCard}>
        <h2 className="mb-3 text-sm font-medium">Últimos 6 meses</h2>
        <MonthlyTrend data={chartData} monthHref={monthHref} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Anotar</h2>
        <QuickEntryForm accounts={quickAccounts} categories={categories} />
      </div>

      {filterCategoryId ? (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>
            Grilla filtrada por la categoría seleccionada en el gráfico.
          </span>
          <Link
            href={filterHref(null)}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <X className="size-3.5" /> Ver todas
          </Link>
        </div>
      ) : null}

      <MonthGrid planilla={planilla} currencyMeta={currencyMeta} filterCategoryId={filterCategoryId} />
    </div>
  );
}
