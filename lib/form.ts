// Read a submitted form field. Next/React normally hand a server action a
// decoded FormData with the original input names ("title"). Be defensive: if
// the useActionState wire prefix ("_1_title") ever survives into the action's
// FormData, fall back to the prefixed key so the form still works.
export function readField(formData: FormData, name: string): string {
  const direct = formData.get(name);
  if (typeof direct === "string") return direct;
  for (const [key, value] of formData.entries()) {
    if (
      typeof value === "string" &&
      /^_\d+_/.test(key) &&
      key.endsWith(`_${name}`)
    ) {
      return value;
    }
  }
  return "";
}
