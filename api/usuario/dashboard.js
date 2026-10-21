app.get('/api/usuario/dashboard', async (req, res) => {
  const { userId } = req.query;
  
  // Consulta a tu base de datos (ej. MongoDB, PostgreSQL, etc.)
  const usuario = await BaseDeDatos.obtenerUsuario(userId);
  const historial = await BaseDeDatos.obtenerTransacciones(userId);

  res.json({
    saldoReal: usuario.saldo, // Dinero real procesado
    transacciones: historial
  });
});