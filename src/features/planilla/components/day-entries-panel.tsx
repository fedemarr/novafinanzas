"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, money } from "@/lib/domain/money";
import type { MonthEntry } from "../queries";
import { deletePlanillaEntry, updatePlanillaEntry, type EditEntryState } from "../actions";

interface CategoryOption {
  id: string;
  name: string;
}

interface CurrencyMeta {
  symbol: string;
  decimals: number;
}

interface DayEntriesPanelProps {
  entries: MonthEntry[];
  selectedDay: number | null;
  categories: CategoryOption[];
  currencyCode: string;
  currencyMeta: CurrencyMeta;
  /** Href sin ?dia= para cerrar el panel. */
  closeHref: string;
}

const selectClass = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

export function DayEntriesPanel({
  entries,
  selectedDay,
  categories,
  currencyCode,
  currencyMeta,
  closeHref,
}: DayEntriesPanelProps) {
  const dayEntries = selectedDay ? entries.filter((e) => e.day === selectedDay) : [];

  if (!selectedDay || dayEntries.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Movimientos del día {selectedDay}</h2>
        <Link
          href={closeHref}
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {dayEntries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            categories={categories}
            currencyCode={currencyCode}
            currencyMeta={currencyMeta}
          />
        ))}
      </div>
    </div>
  );
}

interface EntryRowProps {
  entry: MonthEntry;
  categories: CategoryOption[];
  currencyCode: string;
  currencyMeta: CurrencyMeta;
}

const entryInitialState: EditEntryState = { error: null, success: false };

function EntryRow({ entry, categories, currencyCode, currencyMeta }: EntryRowProps) {
  const [editing, setEditing] = useState(false);
  const fmt = (raw: string) =>
    formatMoney(money(raw, currencyCode), currencyMeta);
  const isExpense = entry.type === "EXPENSE";

  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={
              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
              (isExpense
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")
            }
          >
            {isExpense ? "Gasto" : "Ingreso"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {entry.description || entry.categoryName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {entry.categoryName}
              {entry.categoryIcon ? ` ${entry.categoryIcon}` : ""} · {entry.accountName}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p
            className={
              "font-semibold tabular-nums " +
              (isExpense ? "text-foreground" : "text-emerald-600 dark:text-emerald-400")
            }
          >
            {isExpense ? "-" : "+"}
            {fmt(entry.amount)}
          </p>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Editar"
          >
            <Pencil className="size-3.5" />
          </button>
          <form action={deletePlanillaEntry.bind(null, entry.id)}>
            <button
              type="submit"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Borrar"
            >
              <Trash2 className="size-3.5" />
            </button>
          </form>
        </div>
      </div>

      {editing ? (
        <EditForm
          key={`${entry.id}-${entry.amount}-${entry.occurredAt}-${entry.categoryId ?? ""}`}
          entryId={entry.id}
          entry={entry}
          categories={categories}
        />
      ) : null}
    </div>
  );
}

interface EditFormProps {
  entryId: string;
  entry: MonthEntry;
  categories: CategoryOption[];
}

function EditForm({ entryId, entry, categories }: EditFormProps) {
  const [state, formAction, isPending] = useActionState(
    updatePlanillaEntry.bind(null, entryId),
    entryInitialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`amount-${entryId}`} className="text-xs text-muted-foreground">
          Monto
        </Label>
        <Input
          id={`amount-${entryId}`}
          name="amount"
          type="text"
          inputMode="decimal"
          defaultValue={entry.amount}
          className="h-9 w-28 tabular-nums"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`category-${entryId}`} className="text-xs text-muted-foreground">
          Categoría
        </Label>
        <select
          id={`category-${entryId}`}
          name="categoryId"
          defaultValue={entry.categoryId ?? ""}
          className={selectClass + " max-w-40"}
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`date-${entryId}`} className="text-xs text-muted-foreground">
          Fecha
        </Label>
        <Input
          id={`date-${entryId}`}
          name="occurredAt"
          type="date"
          defaultValue={entry.occurredAt}
          className="h-9"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`desc-${entryId}`} className="text-xs text-muted-foreground">
          Detalle
        </Label>
        <Input
          id={`desc-${entryId}`}
          name="description"
          maxLength={200}
          defaultValue={entry.description ?? ""}
          placeholder="opcional"
          className="h-9 w-36"
        />
      </div>

      <Button type="submit" disabled={isPending} className="h-9">
        {isPending ? "Guardando..." : "Guardar"}
      </Button>

      {state.error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="w-full text-sm text-emerald-600 dark:text-emerald-400">
          Movimiento actualizado.
        </p>
      ) : null}
    </form>
  );
}
