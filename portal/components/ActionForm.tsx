"use client";

import { type ReactNode, useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { ActionResult } from "@/lib/actions";

export function SubmitButton({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: "primary" | "quiet" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`button button-${tone}`} disabled={pending} aria-busy={pending}>
      {children}
    </button>
  );
}

type Props = {
  action: (previous: ActionResult, form: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
};

/** A form bound to a server action that shows the action's result next to the fields. */
export function ActionForm({ action, children, className }: Props) {
  const [result, formAction] = useActionState(action, { status: "idle" } as ActionResult);
  return (
    <form action={formAction} className={className}>
      {children}
      {result.status === "error" && (
        <p role="alert" className="form-error">
          {result.message}
        </p>
      )}
      {result.status === "ok" && (
        <div role="status" className="form-ok">
          <p>{result.message}</p>
          {result.secret && (
            <dl className="secret">
              <dt>Client ID</dt>
              <dd>
                <code>{result.secret.clientId}</code>
              </dd>
              <dt>Client secret</dt>
              <dd>
                <code>{result.secret.clientSecret}</code>
              </dd>
              <p className="hint">Copy the secret now. It won&apos;t be shown again.</p>
            </dl>
          )}
        </div>
      )}
    </form>
  );
}
