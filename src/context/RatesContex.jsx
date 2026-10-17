import { createContext, useContext } from 'react';
import { useRates } from '../features/rates/useRates';

const RatesContext = createContext(null);

export function RatesProvider({ children }) {
  const value = useRates();
  return <RatesContext.Provider value={value}>{children}</RatesContext.Provider>;
}

export const useRatesContext = () => {
  const ctx = useContext(RatesContext);
  if (!ctx) throw new Error('useRatesContext debe usarse dentro de <RatesProvider>');
  return ctx;
};