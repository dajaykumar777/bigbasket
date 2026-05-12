/**
 * ocrProcessor.js
 *
 * Handles text extraction from uploaded images and PDFs, then
 * parses the raw OCR text into structured invoice fields.
 *
 * Strategy:
 *   PDF  → try pdfjs text layer first (fast, accurate for digital PDFs)
 *          if text layer is empty → render page as canvas → Tesseract OCR
 *   Image → Tesseract OCR directly
 */

import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js needs its own worker. Point it at the CDN copy.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs';

// ─────────────────────────────────────────────────────────────
// Text extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extract text from an image File using Tesseract.js OCR.
 */
async function ocrImage(file, onProgress) {
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  const url = URL.createObjectURL(file);
  const { data } = await worker.recognize(url);
  await worker.terminate();
  URL.revokeObjectURL(url);
  return data.text;
}

/**
 * Try to extract the text layer from the first page of a PDF.
 * Groups text items into lines by Y coordinate so that labels and
 * their values on the same row end up on the same output line.
 * Returns empty string if the PDF has no embedded text.
 */
async function extractPdfTextLayer(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const items = content.items.filter((i) => i.str?.trim());
  if (!items.length) return '';

  // PDF transform: [scaleX, skewX, skewY, scaleY, x, y]
  // Y increases upward in PDF space, so sort descending (top of page first),
  // then ascending by X (left to right).
  const sorted = [...items].sort((a, b) => {
    const dy = b.transform[5] - a.transform[5];
    if (Math.abs(dy) > 4) return dy;
    return a.transform[4] - b.transform[4];
  });

  const lines = [];
  let curLine = [];
  let curY = null;
  for (const item of sorted) {
    const y = item.transform[5];
    if (curY === null || Math.abs(y - curY) <= 4) {
      curLine.push(item.str);
      if (curY === null) curY = y;
    } else {
      const joined = curLine.join(' ').replace(/\s+/g, ' ').trim();
      if (joined) lines.push(joined);
      curLine = [item.str];
      curY = y;
    }
  }
  const last = curLine.join(' ').replace(/\s+/g, ' ').trim();
  if (last) lines.push(last);

  return lines.join('\n');
}

/**
 * Render the first page of a PDF to a canvas and OCR it.
 */
async function ocrPdfFirstPage(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 }); // 2× for better OCR accuracy

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Convert canvas to Blob then OCR
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  const url = URL.createObjectURL(blob);
  const { data } = await worker.recognize(url);
  await worker.terminate();
  URL.revokeObjectURL(url);
  return data.text;
}

/**
 * Main entry point.
 * @param {File} file - the uploaded image or PDF
 * @param {Function} onProgress - callback(0-100)
 * @returns {Promise<string>} raw extracted text
 */
export async function extractText(file, onProgress) {
  let text;
  if (file.type === 'application/pdf') {
    const layerText = await extractPdfTextLayer(file);
    if (isPdfTextUsable(layerText)) {
      text = layerText;
    } else {
      // Text layer empty or garbled (non-standard embedded fonts) — OCR instead
      console.log('[OCR] PDF text layer unusable, falling back to canvas OCR');
      text = await ocrPdfFirstPage(file, onProgress);
    }
  } else {
    text = await ocrImage(file, onProgress);
  }
  console.log('%c[OCR raw text]', 'color:teal;font-weight:bold', '\n' + text);
  return text;
}

/**
 * Returns true if the PDF text layer looks like real readable text.
 * Garbled/unmapped-font PDFs score < 5% real words; usable ones score > 20%.
 */
function isPdfTextUsable(text) {
  if (!text || text.trim().length < 50) return false;
  const tokens = text.trim().split(/\s+/);
  if (tokens.length < 6) return false;
  const realWords = tokens.filter((tok) => /[A-Za-z]{3,}/.test(tok)).length;
  return (realWords / tokens.length) >= 0.20;
}

// ─────────────────────────────────────────────────────────────
// Invoice field parser
// ─────────────────────────────────────────────────────────────

/**
 * Parse raw text into invoice fields using regex heuristics.
 * Results are best-effort — the user can always correct them.
 *
 * @param {string} text
 * @returns {object} partial invoice fields
 */
export function parseInvoiceText(text) {
  const result = {
    invoiceNumber: '',
    vendorName: '',
    invoiceDate: '',
    taxId: '',
    amount: '',
    tax: '',
    total: '',
    currency: 'GBP',
  };

  if (!text) return result;

  const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  // t = normalised single-space version (good for most patterns)
  // raw = original text kept for multiline patterns
  const t   = text.replace(/\s+/g, ' ');
  const raw = text;

  // ── Currency ─────────────────────────────────────────────
  if (/₹|INR/i.test(t))              result.currency = 'INR';
  else if (/€|EUR/i.test(t))          result.currency = 'EUR';
  else if (/(?<!\w)\$|USD/i.test(t))  result.currency = 'USD';
  else if (/£|GBP|STERLING/i.test(t)) result.currency = 'GBP';

  // ── Invoice number ────────────────────────────────────────────────────────
  // Three-pass approach to handle PDFs (clean lines) and photos (OCR noise,
  // possible misreads like "lnvoice" for "Invoice", split lines, etc.).
  //
  // Pass 1: line-by-line strict label match  → best for clean PDFs
  // Pass 2: line-by-line fuzzy label match   → handles OCR misreads & noise
  // Pass 3: flat-text regex on `t`           → last resort
  {
    // Alpha-prefix format:  INV-2024-0521, SI-4587, PO-001
    const alphaFmt = /\b([A-Za-z]{1,5}-\d[\w\-]{1,15})\b/;
    // In label context: accept any 2+ digit number (987, 549473)
    const numFmtLabel = /\b(\d{2,15})\b/;
    // In flat-text pass without label anchor: require 5+ digits
    const numFmtFlat  = /\b(\d{5,15})\b/;

    function extractFromHaystack(h, numFmt) {
      const mA = h.match(alphaFmt);
      if (mA) return mA[1].toUpperCase();
      const mN = h.match(numFmt);
      if (mN) return mN[1];
      return '';
    }

    // Pass 1: strict — line must contain the exact label words
    const strictRe = /\binvoice\s*(?:no\.?|number)\b/i;
    for (let i = 0; i < lines.length && !result.invoiceNumber; i++) {
      if (!strictRe.test(lines[i])) continue;
      const rest = lines[i].replace(new RegExp('.*?' + strictRe.source, 'i'), '');
      const hay  = rest + ' ' + (lines[i + 1] ?? '');
      result.invoiceNumber = extractFromHaystack(hay, numFmtLabel);
    }

    // Pass 2: fuzzy — handles OCR misreads (lnvoice, Involce, lnv, etc.)
    if (!result.invoiceNumber) {
      const fuzzyRe = /[Il1]nv[o0]?[il1]?[c]?e?.{0,6}(?:no\.?|num(?:ber)?)\s*[;:.\-]?\s*/i;
      for (let i = 0; i < lines.length && !result.invoiceNumber; i++) {
        if (!fuzzyRe.test(lines[i])) continue;
        const rest = lines[i].replace(new RegExp('.*?' + fuzzyRe.source, 'i'), '');
        const hay  = rest + ' ' + (lines[i + 1] ?? '');
        result.invoiceNumber = extractFromHaystack(hay, numFmtLabel);
      }
    }

    // Pass 3: flat text — label anywhere in `t`, value within 60 chars after it
    if (!result.invoiceNumber) {
      const flatRe = /\binvoice\s*(?:no\.?|number)\b[^A-Za-z\r\n]{0,60}?([A-Za-z]{1,5}-\d[\w\-]{1,15}|\d{5,15})/i;
      const fm = t.match(flatRe);
      if (fm) result.invoiceNumber = fm[1].toUpperCase();
    }

    // Log what we found (visible in browser DevTools → Console)
    console.log('[OCR invoice#]', result.invoiceNumber || '(not found)');
  }

  // ── Date ─────────────────────────────────────────────────
  {
    const patterns = [
      /(?:invoice[\s]*date|dated?)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      /(?:invoice[\s]*date|dated?)\s*[:\-]?\s*(\d{1,2}\s+\w+\s+\d{4})/i,
      // Multiline: "Invoice Date:\n19/02/26"
      /(?:invoice[\s]*date|dated?)\s*[:\-]?\s*\n\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/im,
      // Bare date anywhere
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
    ];
    for (const p of patterns) {
      const src = p.flags.includes('m') ? raw : t;
      const m = src.match(p);
      if (m) {
        result.invoiceDate = normaliseDateToISO(m[1].trim());
        break;
      }
    }
  }

  // ── VAT / Tax registration number ─────────────────────────
  {
    const patterns = [
      /VAT\s*No\.?\s*[:\-]?\s*([A-Z]{0,3}\s*\d[\d\s]{5,16})/i,
      /GSTIN?\s*[:\-]?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])/i,
      /Tax\s*(?:ID|No)\.?\s*[:\-]?\s*([A-Z0-9\-]{4,20})/i,
    ];
    for (const p of patterns) {
      const m = t.match(p);
      if (m) { result.taxId = m[1].trim(); break; }
    }
  }

  // ── Amounts ───────────────────────────────────────────────
  // Use lastMatch so summary rows (at end of doc) win over table column headers.

  // Invoice Total
  result.total = (
    lastMatch(/invoice[\s]*total\s*[:\-]?\s*([\d,]+\.\d{2})/i, t) ||
    // "Total Amount Due £89.52"
    lastMatch(/total\s+amount\s+due\s*[:\-]?\s*(?:[£$€₹])?\s*([\d,]+\.\d{2})/i, t) ||
    lastMatch(/total\s+(?:payable|due|amount)\s*[:\-]?\s*(?:[£$€₹])?\s*([\d,]+\.\d{2})/i, t) ||
    lastMatch(/\bamount\s+due\s*[:\-]?\s*(?:[£$€₹])?\s*([\d,]+\.\d{2})/i, t) ||
    // Generic "Total" — exclude sub-total by requiring no preceding "sub"
    lastMatch(/(?<!sub[\s\-])\btotal\s*[:\-]?\s*(?:[£$€₹])?\s*([\d,]+\.\d{2})(?!\s*(?:case|qty|split))/i, t)
  )?.[1]?.replace(/,/g, '') ?? '';

  // VAT / Tax amount.
  // Primary: "VAT (20%) 14.92" — percentage in parentheses before amount.
  // Secondary: "14.50| Weight/Loose" — UK wholesale invoice summary tables.
  // Fallback: "VAT NNN.NN" keyword match.
  result.tax = (
    lastMatch(/\bVAT\s*\([^)]+\)\s*([\d,]+\.\d{2})/i, t) ||
    lastMatch(/(\d{1,6}\.\d{2})\s*\|?\s*Weight\s*[\/\\]?\s*Loose/i, t) ||
    lastMatch(/\bVAT\b(?!\s*(?:No|Reg|anal|rate|code|no\.))[^\d]{0,8}([\d,]+\.\d{2})(?!\s*%)/i, t)
  )?.[1]?.replace(/,/g, '') ?? '';

  // Goods subtotal (before VAT).
  // OCR often drops the decimal point in table cells (1240.68 → 124068).
  // Don't try to parse the mangled number — derive from Total − VAT instead.
  result.amount = (
    lastMatch(/\bgoods\b[^\d]{0,8}([\d,]+\.\d{2})/i, t) ||
    lastMatch(/sub[\s\-]?total\s*[:\-]?\s*(?:[£$€₹])?\s*([\d,]+\.\d{2})/i, t) ||
    lastMatch(/net\s*(?:amount|total)?\s*[:\-]?\s*(?:[£$€₹])?\s*([\d,]+\.\d{2})/i, t)
  )?.[1]?.replace(/,/g, '') ?? '';

  // Derive amount from total − tax if still missing
  if (result.total && !result.amount) {
    const tot = parseFloat(result.total);
    const tax = parseFloat(result.tax || 0);
    if (!isNaN(tot)) result.amount = (tot - tax).toFixed(2);
  }

  // ── Vendor name ──────────────────────────────────────────────────────────
  // Two-column PDFs merge company name + invoice header on the same extracted
  // line (e.g. "City Mart Wholesale Invoice No. : INV-2024-0521").
  // `trimAtLabel` strips from the first invoice-header keyword onward so we
  // keep only the company name portion.
  const trimAtLabel = (s) =>
    s.replace(/\b(?:invoice|tax\s*invoice|sales\s*invoice)\b.*/i, '').trim();

  // Strategy 1: explicit "Supplier / Bill From:", "Bill From:", "Supplier:" label
  {
    const labelRe = /(?:supplier\s*[\/&]?\s*bill\s*from|bill\s*from|\bsupplier\b(?!\s*ref)|\bissued\s*by\b|\bsold\s*by\b)\s*[:\-]?\s*/i;
    for (let i = 0; i < lines.length; i++) {
      if (!labelRe.test(lines[i])) continue;
      const afterLabel = lines[i].replace(new RegExp('^.*?' + labelRe.source, 'i'), '').trim();
      const pool = [afterLabel, lines[i + 1]?.trim() ?? '', lines[i + 2]?.trim() ?? ''];
      for (const candidate of pool) {
        const trunc = trimAtLabel(candidate);
        if (trunc.length < 4 || !/[A-Za-z]{3,}/.test(trunc) || /^[\d\W]/.test(trunc)) continue;
        result.vendorName = sanitiseVendor(trunc);
        break;
      }
      break;
    }
  }

  // Strategy 2: heuristic scan — first 14 lines.
  // Requires 2+ real words (3+ alpha chars each) to reject OCR garbage from logos.
  if (!result.vendorName) {
    const skipLine = /^(invoice|tax\s*invoice|sales\s*invoice|business\s*invoice|deliver|telephone|supplier\s*[\/&:]|bill\s*(from|to)|client\s*info|unit\s*\d|tel[:\s]|fax[:\s]|https?:|www\b|ww\b|awrs|vat\s*no|goods\s+without|thank\s+you|page\s*\d|company\s*reg|reg\.?\s*no|route|operator|reference|a\/c\s*code|our\s*ref|currency|weight|total|subtotal|amount|invoice\s*to|deliver\s*to|name:|address:|phone:|email:)/i;
    const urlLike      = /\.(com|co\.uk|net|org|io|biz)\b|\bww[w\s\.]/i;
    const hasRealWords = (s) => (s.match(/[A-Za-z]{3,}/g) ?? []).length >= 2;
    for (const line of lines.slice(0, 14)) {
      if (line.length < 5) continue;
      if (skipLine.test(line)) continue;
      if (urlLike.test(line)) continue;
      if (/^[\d\W]/.test(line)) continue;
      const trunc = trimAtLabel(line);
      if (trunc.length < 4 || !hasRealWords(trunc)) continue;
      result.vendorName = sanitiseVendor(trunc);
      break;
    }
  }

  return result;
}


/**
 * Returns true if a string looks like invoice metadata (not a company name).
 */
function isInvoiceMeta(str) {
  return /\b(invoice|number|date|total|vat|tax|amount|payment|delivery|order|reference|due\s*date|no\.|page)\b/i.test(str);
}

/**
 * Strip leading non-letter characters (OCR noise like ©, ®, symbols)
 * and normalise whitespace in a vendor name string.
 */
function sanitiseVendor(str) {
  return str.replace(/\s+/g, ' ').replace(/^[^A-Za-z]+/, '').trim();
}

/**
 * Find the LAST match of a regex in a string.
 * Used so summary-row values (at end of document) take priority over table headers.
 */
function lastMatch(regex, str) {
  const gRegex = new RegExp(regex.source, regex.flags.replace('g', '') + 'g');
  let match, last = null;
  while ((match = gRegex.exec(str)) !== null) last = match;
  return last;
}

/**
 * Internal: render a file to a canvas JPEG data-URL.
 * @param {File} file
 * @param {number} pdfScale   - pdfjs render scale for PDFs
 * @param {number} imageMax   - max dimension (px) for images
 * @param {number} quality    - JPEG quality 0-1
 */
async function _renderToJpeg(file, pdfScale, imageMax, quality) {
  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: pdfScale });
    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas.toDataURL('image/jpeg', quality);
  } else {
    const dataUrl = await new Promise((res) => {
      const reader = new FileReader();
      reader.onload = (e) => res(e.target.result);
      reader.readAsDataURL(file);
    });
    return await new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > imageMax) { h = Math.round(h * imageMax / w); w = imageMax; }
        if (h > imageMax) { w = Math.round(w * imageMax / h); h = imageMax; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        res(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  }
}

/**
 * Generate a small JPEG thumbnail (base64) for the invoice table cell.
 * PDF scale 0.5 · image max 600px · quality 0.55
 */
export async function generateThumbnail(file) {
  try { return await _renderToJpeg(file, 0.5, 600, 0.55); }
  catch (e) { console.warn('Thumbnail generation failed:', e); return ''; }
}

/**
 * Generate a higher-resolution JPEG preview (base64) for the lightbox.
 * PDF scale 1.8 · image max 1400px · quality 0.88
 */
export async function generatePreview(file) {
  try { return await _renderToJpeg(file, 1.8, 1400, 0.88); }
  catch (e) { console.warn('Preview generation failed:', e); return ''; }
}

/**
 * Normalise a date string to ISO format YYYY-MM-DD for the HTML date input.
 * Handles DD/MM/YY, DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, "24 May 2024" etc.
 */
function normaliseDateToISO(raw) {
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Word month: "24 May 2024" or "24 May, 2024"
  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const wmDay = raw.match(/(\d{1,2})\s+([a-z]{3,9}),?\s+(\d{4})/i);
  if (wmDay) {
    const mon = MONTHS[wmDay[2].slice(0, 3).toLowerCase()];
    if (mon) return `${wmDay[3]}-${String(mon).padStart(2,'0')}-${wmDay[1].padStart(2,'0')}`;
  }
  // Word month: "May 24 2024" or "May 24, 2024"
  const wmMonth = raw.match(/([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/i);
  if (wmMonth) {
    const mon = MONTHS[wmMonth[1].slice(0, 3).toLowerCase()];
    if (mon) return `${wmMonth[3]}-${String(mon).padStart(2,'0')}-${wmMonth[2].padStart(2,'0')}`;
  }

  const sep = raw.match(/[\/\-\.]/)?.[0];
  if (!sep) return raw;
  const parts = raw.split(sep);
  if (parts.length !== 3) return raw;

  let [a, b, c] = parts;

  // If year part is 2-digit, expand it
  if (c.length === 2) {
    const yr = parseInt(c, 10);
    c = (yr >= 50 ? '19' : '20') + c.padStart(2, '0');
  }

  // If first part looks like a 4-digit year → already YYYY-MM-DD-ish
  if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;

  // Assume DD/MM/YYYY (UK format)
  return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
}
