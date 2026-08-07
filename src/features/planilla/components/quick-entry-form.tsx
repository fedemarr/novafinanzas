"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createQuickEntry, type QuickEntryState } from "../actions";

const initialState: QuickEntryState = { error: null, success: false };

interface AccountOption {
  id: string;
  name: string;
  currencyCode: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface QuickEntryFormProps {
  accounts: AccountOption[];
  categories: CategoryOption[];
}

const selectClass = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

function todayInputValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
  return local;
}

export function QuickEntryForm({ accounts, categories }: QuickEntryFormProps) {
  const [state, formAction, isPending] = useActionState(createQuickEntry, initialState);
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  if (accounts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Primero creá una cuenta para poder anotar gastos.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3"
    >
      <input type="hidden" name="type" value={type} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quick-type" className="text-xs text-muted-foreground">
          Tipo
        </Label>
        <div className="flex overflow-hidden rounded-md border">
          {(["EXPENSE", "INCOME"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={
                "px-3 py-1.5 text-sm " +
                (type === t
                  ? t === "EXPENSE"
                    ? "bg-destructive/15 font-medium text-destructive"
                    : "bg-emerald-500/15 font-medium text-emerald-700 dark:text-emerald-400"
                  : "text-muted-foreground")
              }
            >
              {t === "EXPENSE" ? "Gasto" : "Ingreso"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quick-amount" className="text-xs text-muted-foreground">
          Monto
        </Label>
        <Input
          id="quick-amount"
          name="amount"
          type="text"
          inputMode="decimal"
          placeholder="0"
          className="h-9 w-28 tabular-nums"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quick-category" className="text-xs text-muted-foreground">
          Categoría
        </Label>
        <select id="quick-category" name="categoryId" defaultValue="" className={selectClass + " max-w-40"}>
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quick-account" className="text-xs text-muted-foreground">
          Cuenta
        </Label>
        <select
          id="quick-account"
          name="accountId"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className={selectClass}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <input
        type="hidden"
        name="currencyCode"
        value={selectedAccount?.currencyCode ?? ""}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quick-date" className="text-xs text-muted-foreground">
          Fecha
        </Label>
        <Input id="quick-date" name="occurredAt" type="date" defaultValue={todayInputValue()} className="h-9" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quick-description" className="text-xs text-muted-foreground">
          Detalle
        </Label>
        <Input id="quick-description" name="description" maxLength={200} placeholder="opcional" className="h-9 w-36" />
      </div>

      <Button type="submit" disabled={isPending} className="h-9">
        {isPending ? "Guardando..." : type === "EXPENSE" ? "+ Gasto" : "+ Ingreso"}
      </Button>

      {state.error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="w-full text-sm text-emerald-600 dark:text-emerald-400">
          Anotado. Sumá otro o seguí con tu día.
        </p>
      ) : null}
    </form>
  );
}
