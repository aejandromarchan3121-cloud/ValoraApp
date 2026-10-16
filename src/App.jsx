import React, { useState, useEffect } from 'react';
import { supabase } from './Supabase';
import { supabase } from './supabase';

export default function App() {
  const [productos, setProductos] = useState([]);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('');

  const [moneda, setMoneda] = useState('VES');
  const [montoP2P, setMontoP2P] = useState('');
  const [resultadoP2P, setResultadoP2P] = useState(null);
  const [cargandoP2P, setCargandoP2P] = useState(false);

  useEffect(() => {
    cargarProductos();
  }, []);

  async function cargarProductos() {
    const { data, error } = await supabase.from('productos').select('*');
    if (!error && data) setProductos(data);
  }

  async function agregarProducto(e) {
    e.preventDefault();
    if (!nombre || !precio || !stock) return;

    const { error } = await supabase.from('productos').insert([
      { nombre, precio: parseFloat(precio), stock: parseInt(stock) }
    ]);

    if (!error) {
      setNombre('');
      setPrecio('');
      setStock('');
      cargarProductos();
    } else {
      alert('Error al guardar: ' + error.message);
    }
  }

async function calcularP2P() {
    if (!montoP2P) return;
    setCargandoP2P(true);
    try {
      const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: 'USDT',
          fiat: moneda,
          tradeType: 'BUY',
          page: 1,
          rows: 1,
          payTypes: moneda === 'VES' ? ['PagoMovil'] : ['Bancolombia'],
          transAmount: parseFloat(montoP2P)
        })
      });
      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        const oferta = data.data[0].adv;
        const tasaNum = parseFloat(oferta.price);
        const usdtTotal = (parseFloat(montoP2P) / tasaNum).toFixed(2);
        setResultadoP2P({
          tasa: tasaNum,
          comerciante: data.data[0].advertiser.nickName,
          usdtTotal
        });
      } else {
        alert('No se encontraron ofertas con ese monto.');
      }
    } catch (err) {
      console.error(err);
      alert('Error al consultar Binance P2P.');
    }
    setCargandoP2P(false);
  }

  async function registrarTransaccion() {
    if (!resultadoP2P) return;
    const { error } = await supabase.from('transacciones_p2p').insert([
      {
        moneda,
        monto_local: parseFloat(montoP2P),
        monto_usdt: parseFloat(resultadoP2P.usdtTotal),
        tasa: resultadoP2P.tasa,
        estado: 'completado'
      }
    ]);

    if (!error) {
      alert('¡Transacción P2P guardada en Supabase!');
      setMontoP2P('');
      setResultadoP2P(null);
    } else {
      alert('Error al guardar: ' + error.message);
    }
  }
  
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', color: '#fff', background: '#121212', minHeight: '100vh' }}>
      <h1>Gestor de Inventario & Convertidor P2P</h1>

      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #333', borderRadius: '8px' }}>
        <h2>Añadir Producto</h2>
        <form onSubmit={agregarProducto} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ padding: '8px' }} />
          <input placeholder="Precio (USD)" type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} style={{ padding: '8px' }} />
          <input placeholder="Stock" type="number" value={stock} onChange={(e) => setStock(e.target.value)} style={{ padding: '8px' }} />
          <button type="submit" style={{ padding: '8px 15px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px' }}>Agregar</button>
        </form>

        <h3>Lista de Inventario</h3>
        <ul>
          {productos.map((p) => (
            <li key={p.id}>
              {p.nombre} — ${p.precio} | Stock: {p.stock}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ padding: '15px', border: '1px solid #333', borderRadius: '8px' }}>
        <h2>Calculadora P2P Binance</h2>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <select value={moneda} onChange={(e) => setMoneda(e.target.value)} style={{ padding: '8px' }}>
            <option value="VES">Bolívares (VES)</option>
            <option value="COP">Pesos (COP)</option>
          </select>
          <input
            placeholder={`Monto en ${moneda}`}
            type="number"
            value={montoP2P}
            onChange={(e) => setMontoP2P(e.target.value)}
            style={{ padding: '8px' }}
          />
          <button onClick={calcularP2P} disabled={cargandoP2P} style={{ padding: '8px 15px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px' }}>
            {cargandoP2P ? 'Buscando...' : 'Buscar Tasa P2P'}
          </button>
        </div>

      {resultadoP2P && (
          <div style={{ background: '#1e1e1e', padding: '15px', marginTop: '10px', borderRadius: '6px' }}>
            <p><strong>Comerciante:</strong> {resultadoP2P.comerciante}</p>
            <p><strong>Tasa:</strong> 1 USDT = {resultadoP2P.tasa} {moneda}</p>
            <p><strong>Recibes:</strong> {resultadoP2P.usdtTotal} USDT</p>
            <button onClick={registrarTransaccion} style={{ marginTop: '10px', padding: '8px 15px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px' }}>
              Registrar Transacción en Base de Datos
            </button>
          </div>
        )}
      </section>
    </div>
  );
}