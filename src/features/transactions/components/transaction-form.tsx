"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTransaction, type TransactionFormState } from "../actions";
import { RATE_TYPES, TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS } from "../schemas";

const initialState: TransactionFormState = { error: null };

interface AccountOption {
  id: string;
  name: string;
  currencyCode: string;
}

interface TransactionFormProps {
  accounts: AccountOption[];
  categories: { id: string; name: string }[];
  currencies: { code: string; symbol: string }[];
  defaultRateType: (typeof RATE_TYPES)[number];
  defaultOccurredAt: string;
}

const selectClass = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

export function TransactionForm({
  accounts,
  categories,
  currencies,
  defaultRateType,
  defaultOccurredAt,
}: TransactionFormProps) {
  const [state, formAction, isPending] = useActionState(createTransaction, initialState);
  const [type, setType] = useState<(typeof TRANSACTION_TYPES)[number]>("EXPENSE");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [currencyCode, setCurrencyCode] = useState(
    accounts[0]?.currencyCode ?? currencies[0]?.code ?? "",
  );

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const isTransfer = type === "TRANSFER";
  const needsFxRate = !isTransfer && !!selectedAccount && currencyCode !== selectedAccount.currencyCode;

  if (accounts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Primero creá una cuenta.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="type">Tipo</Label>
        <select
          id="type"
          name="type"
          value={type}
          onChange={(e) => {
            const next = e.target.value as (typeof TRANSACTION_TYPES)[number];
            setType(next);
            if (next === "TRANSFER" && selectedAccount) {
              setCurrencyCode(selectedAccount.currencyCode);
            }
          }}
          className={selectClass}
        >
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TRANSACTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="accountId">{isTransfer ? "Cuenta origen" : "Cuenta"}</Label>
        <select
          id="accountId"
          name="accountId"
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value);
            const next = accounts.find((a) => a.id === e.target.value);
            if (isTransfer && next) setCurrencyCode(next.currencyCode);
          }}
          className={selectClass}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currencyCode})
            </option>
          ))}
        </select>
      </div>

      {isTransfer ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="counterAccountId">Cuenta destino</Label>
          <select id="counterAccountId" name="counterAccountId" className={selectClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currencyCode})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Monto</Label>
        <Input id="amount" name="amount" type="text" inputMode="decimal" required />
      </div>

      {isTransfer ? (
        <input type="hidden" name="currencyCode" value={selectedAccount?.currencyCode ?? ""} />
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="currencyCode">Moneda</Label>
          <select
            id="currencyCode"
            name="currencyCode"
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value)}
            className={selectClass}
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.symbol})
              </option>
            ))}
          </select>
        </div>
      )}

      {needsFxRate ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            {currencyCode} es distinto a {selectedAccount?.currencyCode} (la moneda de la
            cuenta) — decime qué rate usaste para esta conversión.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fxRateValue">
              1 {currencyCode} = ___ {selectedAccount?.currencyCode}
            </Label>
            <Input id="fxRateValue" name="fxRateValue" type="text" inputMode="decimal" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fxRateType">Tipo de rate</Label>
            <select
              id="fxRateType"
              name="fxRateType"
              defaultValue={defaultRateType}
              className={selectClass}
            >
              {RATE_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="occurredAt">Fecha</Label>
        <Input
          id="occurredAt"
          name="occurredAt"
          type="date"
          defaultValue={defaultOccurredAt}
          required
        />
      </div>

      {!isTransfer ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="categoryId">Categoría</Label>
          <select id="categoryId" name="categoryId" defaultValue="" className={selectClass}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Input id="description" name="description" maxLength={200} />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Cargar movimiento"}
      </Button>
    </form>
  );
}
