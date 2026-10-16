// api/p2p.js
export async function obtenerTasaP2P(moneda, monto) {
  const asset = 'USDT';
  const tradeType = 'BUY'; // O SELL según la perspectiva
  const payTypes = moneda === 'VES' ? ['PagoMovil'] : ['Bancolombia'];

  try {
    const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset,
        fiat: moneda,
        tradeType,
        page: 1,
        rows: 5,
        payTypes,
        transAmount: monto || null
      })
    });

    const data = await response.json();
    if (data && data.data && data.data.length > 0) {
      // Tomamos la primera oferta con mejor tasa
      const oferta = data.data[0].adv;
      return {
        tasa: parseFloat(oferta.price),
        montoMinimo: parseFloat(oferta.minSingleTransAmount),
        montoMaximo: parseFloat(oferta.maxSingleTransAmount),
        comerciante: data.data[0].advertiser.nickName
      };
    }
    return null;
  } catch (error) {
    console.error('Error al consultar Binance P2P:', error);
    return null;
  }
}