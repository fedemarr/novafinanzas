"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { transferToSavings, type TransferState } from "../actions";

const initialState: TransferState = { error: null, success: false };

interface AccountOption {
  id: string;
  name: string;
  currencyCode: string;
}

interface TransferFormProps {
  fromAccounts: AccountOption[];
  toAccounts: AccountOption[];
}

const selectClass = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

function todayInputValue(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function TransferForm({ fromAccounts, toAccounts }: TransferFormProps) {
  const [state, formAction, isPending] = useActionState(transferToSavings, initialState);
  const [fromAccountId, setFromAccountId] = useState(fromAccounts[0]?.id ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  const selectedFrom = fromAccounts.find((a) => a.id === fromAccountId);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  if (toAccounts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Todavía no tenés cuentas de ahorro. Creá una en Cuentas y marcala como
        &quot;es de ahorro&quot; para poder apartar plata.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from-account" className="text-xs text-muted-foreground">
          Desde
        </Label>
        <select
          id="from-account"
          name="fromAccountId"
          value={fromAccountId}
          onChange={(e) => setFromAccountId(e.target.value)}
          className={selectClass}
        >
          {fromAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currencyCode})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="to-account" className="text-xs text-muted-foreground">
          Hacia el ahorro
        </Label>
        <select id="to-account" name="toAccountId" defaultValue={toAccounts[0]?.id ?? ""} className={selectClass}>
          {toAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currencyCode})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="transfer-amount" className="text-xs text-muted-foreground">
          Monto en {selectedFrom?.currencyCode ?? ""}
        </Label>
        <Input
          id="transfer-amount"
          name="amount"
          type="text"
          inputMode="decimal"
          placeholder="0"
          className="h-9 w-28 tabular-nums"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="transfer-date" className="text-xs text-muted-foreground">
          Fecha
        </Label>
        <Input id="transfer-date" name="occurredAt" type="date" defaultValue={todayInputValue()} className="h-9" />
      </div>

      <Button type="submit" disabled={isPending} className="h-9">
        {isPending ? "Apartando..." : "Apartar"}
      </Button>

      {state.error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="w-full text-sm text-emerald-600 dark:text-emerald-400">
          Apartado. Buen hábito.
        </p>
      ) : null}
    </form>
  );
}
