import { forwardRef } from 'react';
import { ScanBarcode } from 'lucide-react';

/**
 * Input de SKU: acepta escritura manual Y escaneo.
 * Enter (manual o del lector) dispara onResolve(code) para buscar/autocompletar.
 */
const SkuField = forwardRef(function SkuField({ value, onChange, onResolve, className = '' }, ref) {
  return (
    <div className={`relative ${className}`}>
      <ScanBarcode size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
      <input
        ref={ref}
        data-scan-target
        className="glass-input pl-9"
        placeholder="SKU / escanea código"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            e.preventDefault();
            onResolve?.(value.trim());
          }
        }}
        autoComplete="off"
      />
    </div>
  );
});
export default SkuField;
