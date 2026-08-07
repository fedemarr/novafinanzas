"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAccount, updateAccount, type AccountFormState } from "../actions";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "../schemas";
import { knownParserKeys } from "@/lib/ingest/parsers/registry";

const KNOWN_PARSER_KEYS = knownParserKeys();

const initialState: AccountFormState = { error: null };

interface CurrencyOption {
  code: string;
  symbol: string;
}

interface ExistingAccount {
  id: string;
  name: string;
  type: (typeof ACCOUNT_TYPES)[number];
  currencyCode: string;
  institutionKey: string | null;
  isLiquid: boolean;
  isActive: boolean;
  initialBalance: string;
}

interface AccountFormProps {
  currencies: CurrencyOption[];
  account?: ExistingAccount;
}

export function AccountForm({ currencies, account }: AccountFormProps) {
  const action = account ? updateAccount.bind(null, account.id) : createAccount;
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={account?.name} required maxLength={80} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="type">Tipo</Label>
        <select
          id="type"
          name="type"
          defaultValue={account?.type ?? "BANK"}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {ACCOUNT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {account ? (
        <p className="text-xs text-muted-foreground">
          Moneda: {account.currencyCode} (no se puede cambiar después de creada).
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="currencyCode">Moneda</Label>
          <select
            id="currencyCode"
            name="currencyCode"
            defaultValue={currencies[0]?.code}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            required
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.symbol})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="initialBalance">Saldo inicial</Label>
        <Input
          id="initialBalance"
          name="initialBalance"
          type="text"
          inputMode="decimal"
          defaultValue={account?.initialBalance ?? "0"}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="institutionKey">Institución (opcional)</Label>
        <Input
          id="institutionKey"
          name="institutionKey"
          list="known-institutions"
          defaultValue={account?.institutionKey ?? ""}
          placeholder="ej. santander, mercadopago"
        />
        <datalist id="known-institutions">
          {KNOWN_PARSER_KEYS.map((key) => (
            <option key={key} value={key} />
          ))}
        </datalist>
        <p className="text-xs text-muted-foreground">
          Si esta cuenta recibe mails de un banco o billetera, elegí la institución para que
          las compras entren automáticamente.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isLiquid"
          defaultChecked={account?.isLiquid ?? true}
          className="size-4"
        />
        Cuenta líquida (entra en safe-to-spend y runway)
      </label>

      {account ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={account.isActive}
            className="size-4"
          />
          Activa
        </label>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : account ? "Guardar cambios" : "Crear cuenta"}
      </Button>
    </form>
  );
}
