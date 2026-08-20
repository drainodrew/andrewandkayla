"use client";

/**
 * Opens the browser's print dialog. A client component purely because
 * window.print() cannot be called from the server; the page around it stays
 * a server component.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-5 py-2.5 rounded-lg bg-pink text-dark text-sm font-medium hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-pink focus:ring-offset-2 focus:ring-offset-cream transition-colors"
    >
      Print / Save as PDF
    </button>
  );
}
