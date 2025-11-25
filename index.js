const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a MongoDB Atlas
mongoose.connect(
    "mongodb+srv://luiggivalerio_db_user:luiggivaleriodbuser@fitnesssystemdb.pm1cv9a.mongodb.net/FitnessSystemDB?retryWrites=true&w=majority",
    {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    }
)
.then(() => console.log("✅ MongoDB conectado correctamente"))
.catch((err) => console.error("❌ Error al conectar MongoDB:", err));

// MODELOS
const Cliente = mongoose.model("Cliente", new mongoose.Schema({
    nombre: String,
    tipoMembresia: String,
    fechaRegistro: String
}));

const Asistencia = mongoose.model("Asistencia", new mongoose.Schema({
    clienteId: String,
    fecha: String,
    instructor: String,
    horario: String,
    montoCobrado: Number,
    esSegundaClaseDelDia: Boolean
}));

const Pago = mongoose.model("Pago", new mongoose.Schema({
    clienteId: String,
    tipo: String,
    monto: Number,
    fecha: String,
    descripcion: String
}));

const Venta = mongoose.model("Venta", new mongoose.Schema({
  clienteId: { type: String, required: true },
  clienteNombre: { type: String, required: false },

  productos: [
    {
      productId: { type: String, required: true },
      nombre: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true }
    }
  ],

  total: { type: Number, required: true },

  fecha: {
    type: Date,
    default: Date.now
  }
}));

const Producto = mongoose.model("Producto", new mongoose.Schema({
  nombre: { type: String, required: true },
  precio: { type: Number, required: true },
  stock: { type: Number, required: true }
}));

// RUTAS API
app.get("/clientes", async (req, res) => {
    const clientes = await Cliente.find();
    res.json(clientes);
});

app.post("/clientes", async (req, res) => {
    const cliente = new Cliente(req.body);
    await cliente.save();
    res.json(cliente);
});

app.get("/asistencias", async (req, res) => {
    const asistencias = await Asistencia.find();
    res.json(asistencias);
});

app.post("/asistencias", async (req, res) => {
    const asistencia = new Asistencia(req.body);
    await asistencia.save();
    res.json(asistencia);
});

// 🗑️ Eliminar una asistencia por ID
app.delete("/asistencias/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const deleted = await Asistencia.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ success: false, message: "Asistencia no encontrada" });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put("/asistencias/:id", async (req, res) => {
  try {
    const updated = await Asistencia.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "No se pudo actualizar" });
  }
});


app.get("/pagos", async (req, res) => {
    const pagos = await Pago.find();
    res.json(pagos);
});

app.post("/pagos", async (req, res) => {
    const pago = new Pago(req.body);
    await pago.save();
    res.json(pago);
});

// 🗑️ Eliminar un pago por ID
app.delete("/pagos/:id", async (req, res) => {
    try {
        const eliminado = await Pago.findByIdAndDelete(req.params.id);

        if (!eliminado) {
            return res.status(404).json({ success: false, message: "Pago no encontrado" });
        }

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


app.get("/ventas", async (req, res) => {
    try {
        console.log("📥 Consultando ventas...");

        const ventas = await Venta.find().sort({ fecha: -1 }); // últimas primero

        res.status(200).json({
            message: "✅ Ventas obtenidas correctamente",
            total: ventas.length,
            ventas
        });

    } catch (error) {
        console.error("❌ Error al obtener ventas:", error);

        res.status(500).json({
            message: "Error al obtener ventas",
            error: error.message
        });
    }
});

// ✅ REGISTRAR VENTA CON DESCUENTO AUTOMÁTICO DE STOCK
app.post("/ventas", async (req, res) => {
  try {
    const { clienteId, clienteNombre, productos, total, fecha } = req.body;

    // ✅ 1) Validar que haya productos
    if (!productos || productos.length === 0) {
      return res.status(400).json({ error: "No hay productos en la venta" });
    }

    // ✅ 2) Validar stock producto por producto
    for (const item of productos) {
      const prod = await Producto.findById(item.productId);

      if (!prod) {
        return res.status(404).json({ error: `Producto no encontrado: ${item.nombre}` });
      }

      if (prod.stock < item.quantity) {
        return res.status(400).json({
          error: `Stock insuficiente para ${item.nombre}. Disponible: ${prod.stock}, solicitado: ${item.quantity}`
        });
      }
    }

    // ✅ 3) Descontar stock en MongoDB
    for (const item of productos) {
      await Producto.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: -item.quantity } }, // ✅ resta automática
        { new: true }
      );
    }

    // ✅ 4) Guardar la venta
    const venta = new Venta({
      clienteId,
      clienteNombre,
      productos,
      total,
      fecha
    });

    const saved = await venta.save();

    // ✅ 5) Responder venta guardada
    res.status(201).json(saved);

  } catch (error) {
    console.error("❌ Error al registrar venta:", error);
    res.status(500).json({ error: "Error al registrar venta" });
  }
});


// 🗑️ ELIMINAR VENTA POR ID
app.delete("/ventas/:id", async (req, res) => {
    try {
        const ventaId = req.params.id;

        const deleted = await Venta.findByIdAndDelete(ventaId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Venta no encontrada"
            });
        }

        res.json({
            success: true,
            message: "Venta eliminada correctamente",
            venta: deleted
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ✅ Obtener todos los productos
app.get("/productos", async (req, res) => {
  const productos = await Producto.find();
  res.json(productos);
});

// ✅ Crear un nuevo producto
app.post("/productos", async (req, res) => {
  try {
    const producto = new Producto(req.body);
    await producto.save();
    res.status(201).json(producto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ✅ Actualizar solo el stock
app.patch("/productos/:id", async (req, res) => {
  const { stock } = req.body;
  const producto = await Producto.findByIdAndUpdate(
    req.params.id,
    { stock },
    { new: true }
  );
  res.json(producto);
});


// ✅ Obtener un producto por ID
app.get("/productos/:id", async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);

    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json(producto);

  } catch (error) {
    res.status(500).json({ error: "Error al obtener producto" });
  }
});


// ✅ Actualizar stock de un producto
app.put("/productos/:id", async (req, res) => {
    const { stock } = req.body;

    try {
        const updated = await Producto.findByIdAndUpdate(
            req.params.id,
            { stock },
            { new: true }
        );
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: "No se pudo actualizar el stock" });
    }
});

// ✅ REGISTRAR MOVIMIENTO DE STOCK
app.post("/stock-movements", async (req, res) => {
    try {
        const movimiento = new StockMovement(req.body);
        await movimiento.save();
        res.json(movimiento);
    } catch (error) {
        console.error("Error al registrar movimiento:", error);
        res.status(500).json({ error: "Error al registrar movimiento" });
    }
});

// ✅ OBTENER HISTORIAL COMPLETO
app.get("/stock-movements", async (req, res) => {
    try {
        const movimientos = await StockMovement.find().sort({ fecha: -1 });
        res.json(movimientos);
    } catch (error) {
        console.error("Error al obtener historial:", error);
        res.status(500).json({ error: "Error al obtener historial" });
    }
});


// ✅ MODELO PARA HISTORIAL DE STOCK

const StockMovementSchema = new mongoose.Schema({
    productoId: { type: String, required: true },
    productoNombre: { type: String, required: true },
    accion: { type: String, enum: ["add", "reduce"], required: true },
    cantidad: { type: Number, required: true },
    stockAntes: { type: Number, required: true },
    stockDespues: { type: Number, required: true },
    fecha: { type: Date, default: Date.now }
});

// ✅ CREA LA COLECCIÓN "stockmovements"
const StockMovement = mongoose.model("StockMovement", StockMovementSchema);


const GastoSchema = new mongoose.Schema({
  categoria: { type: String, required: true },
  descripcion: { type: String, required: true },
  profesor: { type: String },
  monto: { type: Number, required: true },
  fecha: { type: Date, required: true }
});

const Gasto = mongoose.model("Gasto", GastoSchema);

// ✅ Obtener todos los gastos
app.get("/gastos", async (req, res) => {
  try {
    const gastos = await Gasto.find().sort({ fecha: -1 });
    res.json(gastos);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener gastos" });
  }
});

// ✅ Registrar un gasto
app.post("/gastos", async (req, res) => {
  try {
    const nuevoGasto = new Gasto(req.body);
    await nuevoGasto.save();
    res.json(nuevoGasto);
  } catch (error) {
    res.status(500).json({ error: "Error al registrar gasto" });
  }
});

// ✅ Editar un gasto por ID
app.put("/gastos/:id", async (req, res) => {
  try {
    const updated = await Gasto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar gasto" });
  }
});

// ✅ Eliminar un gasto por ID
app.delete("/gastos/:id", async (req, res) => {
  try {
    await Gasto.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar gasto" });
  }
});


app.listen(5000, () => console.log("🚀 API lista en http://localhost:5000"));

// ✅ IMPORTAR INVENTARIO INICIAL SOLO UNA VEZ
// ✅ IMPORTAR INVENTARIO INICIAL SOLO UNA VEZ
//app.get("/importar-productos-iniciales", async (req, res) => {
  //try {
    //const productosIniciales = [
      //{ nombre: 'AGUA MINERAL 1L', precio: 3.5, stock: 20 },
      //{ nombre: 'BIO', precio: 3.5, stock: 20 },
      //{ nombre: 'OMEGA', precio: 4, stock: 20 },
      //{ nombre: 'P.H', precio: 2, stock: 20 },
      //{ nombre: 'HIDRATANTE', precio: 3.5, stock: 20 },
      //{ nombre: 'CALCIO', precio: 2, stock: 20 },
      //{ nombre: 'MULTIVITAMINICO', precio: 2, stock: 20 },
      //{ nombre: 'COLAGENO', precio: 10, stock: 20 },
      //{ nombre: 'RNG', precio: 8, stock: 20 },
    //];

    //await Producto.insertMany(productosIniciales);

    //res.json({ message: "✅ Productos iniciales importados correctamente" });
  //} catch (error) {
    //res.status(500).json({ error: error.message });
  //}
//});
