/**
 * Custom field-level validation for forms in this project. We stopped
 * relying on the browser's native validation bubble because it's easy to
 * miss, inconsistent across browsers, and (as of the newer "v" regex flag
 * some browsers now use for `pattern`) can silently no-op if a pattern
 * fails to compile. Forms using this call it with `novalidate` set, then
 * run this on submit instead.
 *
 * Expects each validated field's `id` to have a matching
 * `<span id="{id}-error">` sibling somewhere in the form to write the
 * message into. Fields without a matching span are skipped (not every
 * field needs one — only ones with `required`/`pattern`/a validating
 * `type` can ever fail).
 */
export function validateForm(form: HTMLFormElement): boolean {
  let allValid = true;
  let firstInvalid: HTMLElement | null = null;

  const fields = form.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >('input, select, textarea');

  fields.forEach((field) => {
    const errorEl = field.id
      ? document.getElementById(`${field.id}-error`)
      : null;
    if (!errorEl) return;

    if (field.checkValidity()) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      field.removeAttribute('aria-invalid');
      return;
    }

    allValid = false;
    if (!firstInvalid) firstInvalid = field;

    const validity = field.validity;
    let message = 'Please check this field.';
    if (validity.valueMissing) {
      message = 'This field is required.';
    } else if (validity.patternMismatch || validity.typeMismatch) {
      // `title` already carries a field-specific explanation (e.g.
      // "Numbers only, e.g. 780-555-0123") — reuse it rather than
      // duplicating the same text in two places.
      message = field.title || 'Please match the requested format.';
    }

    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    field.setAttribute('aria-invalid', 'true');
  });

  (firstInvalid as HTMLElement | null)?.focus();
  return allValid;
}

/**
 * Clears a single field's error as the visitor fixes it, instead of
 * making them re-submit to find out it's now valid.
 */
export function clearFieldErrorOnInput(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
) {
  if (!field.id) return;
  const errorEl = document.getElementById(`${field.id}-error`);
  if (!errorEl) return;

  const clear = () => {
    if (field.checkValidity()) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      field.removeAttribute('aria-invalid');
    }
  };

  field.addEventListener('input', clear);
  field.addEventListener('change', clear);
}
