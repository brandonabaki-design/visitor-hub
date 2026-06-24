// Minimal HTML escaping for interpolating user-provided values into HTML
// (emails, previews). Policy bodies are trusted/admin-authored and are NOT
// escaped where intentionally rendered as markup.

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default escapeHtml;
