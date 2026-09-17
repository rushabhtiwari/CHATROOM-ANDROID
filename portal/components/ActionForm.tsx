"use client";

import Link from "next/link";
import { createContext, type ReactNode, useActionState, useContext } from "react";
import { useFormStatus } from "react-dom";

import type { ActionResult } from "@/lib/actions";

const TONES = { primary: "button button-primary", quiet: "button", danger: "button button-danger" } as const;

export function SubmitButton({
  children,
  tone = "primary",
  small = false,
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  small?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`${TONES[tone]}${small ? " button-small" : ""}`}
      disabled={pending}
      aria-busy={pending}
    >
      {children}
    </button>
  );
}

const ResultContext = createContext<ActionResult>({ status: "idle" });

/** The result of the surrounding ActionForm; place it where the message should appear. */
export function ActionMessage() {
  const result = useContext(ResultContext);
  if (result.status === "error") {
    return (
      <p role="alert" className="form-message form-error">
        {result.message}
      </p>
    );
  }
  if (result.status !== "ok") return null;
  return (
    <div role="status" className="form-message form-ok">
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
      {result.link && (
        <Link href={result.link.href} className="button button-small result-link">
          {result.link.label}
        </Link>
      )}
    </div>
  );
}

type Props = {
  action: (previous: ActionResult, form: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  /** Render the result after the children (default). Turn off and place <ActionMessage /> instead. */
  showMessage?: boolean;
};

/** A form bound to a server action that shows the action's result. */
export function ActionForm({ action, children, className, showMessage = true }: Props) {
  const [result, formAction] = useActionState(action, { status: "idle" } as ActionResult);
  return (
    <ResultContext.Provider value={result}>
      <form action={formAction} className={className}>
        {children}
        {showMessage && <ActionMessage />}
      </form>
    </ResultContext.Provider>
  );
}
