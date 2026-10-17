import { useEffect, useRef } from 'react';

/**
 * Detecta lectores USB/Bluetooth (modo teclado): ráfaga rápida de teclas + Enter.
 * - Con foco fuera de inputs: siempre actúa.
 * - Con foco en un input: solo si está dentro de un elemento [data-scan-target] (tus inputs manuales no se tocan).
 */
export function useBarcodeScanner(onScan, { enabled = true, minLength = 4, maxGapMs = 60 } = {}) {
  const buffer = useRef('');
  const lastTs = useRef(0);
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      const editable = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (editable && !el.closest('[data-scan-target]')) return;

      const now = performance.now();
      if (now - lastTs.current > maxGapMs) buffer.current = '';
      lastTs.current = now;

      if (e.key === 'Enter') {
        const code = buffer.current.trim();
        buffer.current = '';
        if (code.length >= minLength) {
          e.preventDefault();
          e.stopPropagation(); // evita que el Enter manual del campo lo procese una segunda vez
          cb.current(code);
        }
        return;
      }
      if (e.key.length === 1) buffer.current += e.key;
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [enabled, minLength, maxGapMs]);
}
