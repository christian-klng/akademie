"use client";

import { useFormStatus } from "react-dom";

// Submit button with a native confirm() guard — used for destructive actions
// (event delete). Lives in its own client component so the surrounding form
// can stay a server component.
export function ConfirmSubmit({
  label,
  pendingLabel,
  confirmText,
  className,
}: {
  label: string;
  pendingLabel: string;
  confirmText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
      className={className}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
