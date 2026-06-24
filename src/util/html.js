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

/**
 * Conservatively sanitize admin-authored policy HTML before it is stored and
 * later rendered. This is defense-in-depth: the served app's CSP (script-src
 * 'self', script-src-attr 'none') already blocks inline script/handlers, but
 * stripping dangerous constructs here protects other contexts (e.g. the email
 * receipt, or a deployment without CSP) and limits the blast radius of a
 * compromised admin account.
 */
export function sanitizePolicyHtml(html) {
  return String(html ?? '')
    // Remove whole dangerous elements (with their content).
    .replace(/<\s*(script|style|iframe|object|embed|form|noscript)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    // Remove self-closing / unmatched dangerous tags and other risky tags.
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|noscript|meta|link|base)\b[^>]*>/gi, '')
    // Strip inline event handlers: on*="…", on*='…', on*=value.
    .replace(/\son\w+\s*=\s*"(?:[^"]*)"/gi, '')
    .replace(/\son\w+\s*=\s*'(?:[^']*)'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    // Neutralise javascript:/vbscript:/data: URLs in attributes.
    .replace(/(href|src|xlink:href)\s*=\s*("|')\s*(?:javascript|vbscript|data):[^"']*\2/gi, '$1=$2#$2');
}

export default escapeHtml;
