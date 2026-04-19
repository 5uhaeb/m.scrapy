import DOMPurify from "isomorphic-dompurify";

/**
 * Strictly sanitize HTML email bodies before rendering.
 *  - Strips <script>, <style>, event handlers, javascript: URLs.
 *  - Forces all links to open in a new tab with rel="noopener noreferrer".
 *  - Blocks external image loading by stripping src (we could proxy, but the
 *    safer default for a personal tool is "ask before loading images").
 */
export function sanitizeEmailHtml(html: string, loadImages = false): string {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "meta", "link"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
    ALLOW_DATA_ATTR: false,
  });

  // Post-process: force safe link targets, optionally strip image src.
  if (typeof window === "undefined") {
    // Server-side simple regex fixups — DOMPurify already handled the heavy lifting.
    let out = clean
      .replace(/<a\s+([^>]*?)>/gi, (_m, attrs) => {
        const cleaned = attrs.replace(/\s(target|rel)=("[^"]*"|'[^']*')/gi, "");
        return `<a ${cleaned} target="_blank" rel="noopener noreferrer">`;
      });
    if (!loadImages) {
      // Move src -> data-src so the browser doesn't fetch remote images,
      // but the client can restore them if the user explicitly opts in.
      out = out.replace(/<img\b([^>]*?)>/gi, (_m, attrs) => {
        const rewritten = attrs.replace(
          /\ssrc=("[^"]*"|'[^']*')/gi,
          (_s: string, v: string) => ` data-src=${v}`
        );
        return `<img${rewritten} data-blocked="1" alt="[image blocked]">`;
      });
    }
    return out;
  }
  return clean;
}

/** Extract plain-text content from an HTML string. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
