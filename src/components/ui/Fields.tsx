import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

function FieldShell({
  label,
  hint,
  error,
  children,
  fieldId,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  fieldId: string;
}) {
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const controlClass =
  "h-11 w-full rounded-lg border border-transparent bg-surface-low px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-amber";

export function TextField({
  label,
  hint,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell label={label} hint={hint} error={error} fieldId={fieldId}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={controlClass}
        {...props}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string }) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell label={label} hint={hint} error={error} fieldId={fieldId}>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={`${controlClass} h-28 py-2`}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string }) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell label={label} hint={hint} error={error} fieldId={fieldId}>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={controlClass}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="flex items-start gap-2 text-sm text-ink">
        <input id={fieldId} type="checkbox" className="mt-1 accent-amber" aria-invalid={error ? true : undefined} {...props} />
        <span>{label}</span>
      </label>
      {error ? (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
