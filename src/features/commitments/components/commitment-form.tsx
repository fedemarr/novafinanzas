"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCommitment, updateCommitment, type CommitmentFormState } from "../actions";
import {
  COMMITMENT_KINDS,
  COMMITMENT_KIND_LABELS,
  type CommitmentFormData,
} from "../schemas";
import { isFiniteKind } from "@/lib/domain/commitment";

const initialState: CommitmentFormState = { error: null };

interface CurrencyOption {
  code: string;
  symbol: string;
}

interface AccountOption {
  id: string;
  name: string;
  currencyCode: string;
}

export interface ExistingCommitment {
  id: string;
  name: string;
  kind: CommitmentFormData["kind"];
  accountId: string;
  currencyCode: string;
  totalAmount: string;
  /** Para kinds en cuotas — sale de las ocurrencias, no de Commitment. */
  installmentTotal: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface CommitmentFormProps {
  accounts: AccountOption[];
  currencies: CurrencyOption[];
  defaultStartDate: string;
  existing?: ExistingCommitment;
}

const selectClass = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

export function CommitmentForm({
  accounts,
  currencies,
  defaultStartDate,
  existing,
}: CommitmentFormProps) {
  const action = existing ? updateCommitment.bind(null, existing.id) : createCommitment;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [kind, setKind] = useState<CommitmentFormData["kind"]>(existing?.kind ?? "CARD_INSTALLMENT");

  const isFinite = isFiniteKind(kind);

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
        <Label htmlFor="kind">Tipo</Label>
        <select
          id="kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as CommitmentFormData["kind"])}
          className={selectClass}
        >
          {COMMITMENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {COMMITMENT_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          defaultValue={existing?.name}
          placeholder={isFinite ? "ej. Heladera en cuotas" : "ej. Netflix"}
          required
          maxLength={120}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="accountId">Cuenta</Label>
        <select
          id="accountId"
          name="accountId"
          defaultValue={existing?.accountId ?? accounts[0]?.id}
          className={selectClass}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currencyCode})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="currencyCode">Moneda</Label>
        <select
          id="currencyCode"
          name="currencyCode"
          defaultValue={existing?.currencyCode ?? accounts[0]?.currencyCode ?? currencies[0]?.code}
          className={selectClass}
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} ({c.symbol})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="totalAmount">
          {isFinite ? "Monto total" : "Monto por mes"}
        </Label>
        <Input
          id="totalAmount"
          name="totalAmount"
          type="text"
          inputMode="decimal"
          defaultValue={existing?.totalAmount}
          required
        />
        {isFinite ? (
          <p className="text-xs text-muted-foreground">
            Se divide en las cuotas que elegís abajo.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Ese monto se descuenta cada mes hasta que termina el compromiso.
          </p>
        )}
      </div>

      {isFinite ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="installmentTotal">Cantidad de cuotas</Label>
          <Input
            id="installmentTotal"
            name="installmentTotal"
            type="number"
            min={2}
            max={120}
            defaultValue={existing?.installmentTotal}
            required
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="startDate">Fecha de inicio</Label>
        <Input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={existing?.startDate ?? defaultStartDate}
          required
        />
      </div>

      {!isFinite ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="endDate">Fecha de fin (opcional)</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={existing?.endDate} />
        </div>
      ) : null}

      {existing ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={existing.isActive}
            className="size-4"
          />
          Activo (aparece en el timeline)
        </label>
      ) : (
        <input type="hidden" name="isActive" value="on" />
      )}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : existing ? "Guardar cambios" : "Crear compromiso"}
      </Button>
    </form>
  );
}
