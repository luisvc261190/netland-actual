# 🧪 Guía de Pruebas - Sistema de Vouchers

## Objetivo
Verificar que el sistema de carga de vouchers funciona correctamente en todos los escenarios.

---

## ✅ Checklist de Pruebas

### 1. **Prueba Básica: Subir 1 Voucher**
**Pasos:**
1. Ir a panel admin → Ventas
2. Click en "Nueva Venta"
3. Completar datos del comprador
4. Seleccionar proyecto y lote
5. Modalidad: **Financiado**
6. Cuota inicial: **S/ 2,000.00**
7. Observar que aparece el componente VoucherUploader con nota informativa azul
8. Arrastrar 1 imagen JPG al área de drag & drop
9. Llenar:
   - Monto: **S/ 2,000.00**
   - Fecha: hoy
10. Verificar que muestra: "S/ 2,000.00 / S/ 2,000.00 ✓"
11. Click "Registrar venta"

**Resultado Esperado:**
- ✅ Toast azul: "Procesando venta y subiendo 1 voucher..."
- ✅ Toast verde: "Venta registrada · Contrato CTR-2026-XXXXX · 1 voucher subido correctamente"
- ✅ Se redirige a lista de contratos
- ✅ Al entrar al detalle del contrato, aparece sección "Vouchers del Pago Inicial"
- ✅ Se ve la imagen del voucher con su información
- ✅ Total pagado: S/ 2,000.00

---

### 2. **Prueba: Múltiples Vouchers**
**Pasos:**
1. Nueva venta
2. Cuota inicial: **S/ 5,000.00**
3. Subir 3 vouchers:
   - Voucher 1: S/ 2,000.00 - imagen JPG
   - Voucher 2: S/ 1,500.00 - imagen PNG
   - Voucher 3: S/ 1,500.00 - archivo PDF
4. Verificar progreso: "S/ 5,000.00 / S/ 5,000.00 ✓"
5. Registrar venta

**Resultado Esperado:**
- ✅ Toast: "... subiendo 3 vouchers..."
- ✅ Toast: "... 3 vouchers subidos correctamente"
- ✅ En detalle del contrato aparecen las 3 tarjetas
- ✅ Imágenes JPG/PNG se ven correctamente
- ✅ PDF muestra badge rojo "PDF"
- ✅ Total pagado: S/ 5,000.00

---

### 3. **Prueba: Vouchers Parciales**
**Pasos:**
1. Nueva venta
2. Cuota inicial: **S/ 5,000.00**
3. Subir solo 1 voucher:
   - Voucher 1: S/ 2,000.00
4. Verificar progreso: "S/ 2,000.00 / S/ 5,000.00" (sin ✓)
5. Registrar venta

**Resultado Esperado:**
- ✅ Venta se registra correctamente
- ✅ Toast: "... 1 voucher subido correctamente"
- ✅ En detalle muestra: Total pagado S/ 2,000.00
- ✅ El usuario puede subir el resto después desde módulo Pagos

---

### 4. **Prueba: Sin Vouchers (Opcional)**
**Pasos:**
1. Nueva venta
2. Cuota inicial: **S/ 3,000.00**
3. Ver el VoucherUploader pero **NO subir nada**
4. Click "Registrar venta" directamente

**Resultado Esperado:**
- ✅ Venta se registra normal (sin toast de vouchers)
- ✅ Toast: "Venta registrada · Contrato CTR-2026-XXXXX"
- ✅ En detalle del contrato **NO aparece** sección "Vouchers del Pago Inicial"
- ✅ Sistema funciona perfectamente sin vouchers

---

### 5. **Prueba: Eliminar Vouchers Antes de Enviar**
**Pasos:**
1. Nueva venta
2. Cuota inicial: S/ 4,000.00
3. Subir 2 vouchers
4. Click en el botón X de uno de los vouchers para eliminarlo
5. Verificar que se actualiza el progreso
6. Registrar venta

**Resultado Esperado:**
- ✅ Voucher se elimina de la lista
- ✅ Progreso se actualiza correctamente
- ✅ Solo se sube 1 voucher al backend
- ✅ En detalle solo aparece 1 voucher

---

### 6. **Prueba: Validación de Tipos de Archivo**
**Pasos:**
1. Nueva venta con cuota inicial
2. Intentar arrastrar archivo .docx o .xlsx

**Resultado Esperado:**
- ✅ Alert: "Solo se permiten imágenes (JPG, PNG, etc.) o archivos PDF"
- ✅ Archivo NO se agrega a la lista

---

### 7. **Prueba: Vouchers en Venta Al Contado**
**Pasos:**
1. Nueva venta
2. Modalidad: **Al Contado**
3. Observar el formulario

**Resultado Esperado:**
- ✅ **NO aparece** el VoucherUploader (solo para financiado)
- ✅ Venta se registra normal
- ✅ No hay sección de vouchers en detalle

---

### 8. **Prueba: Validación de Monto Vacío**
**Pasos:**
1. Nueva venta con cuota inicial
2. Subir 1 voucher
3. **No llenar el campo "Monto"**
4. Registrar venta

**Resultado Esperado:**
- ✅ Venta se registra (el voucher sin monto se ignora)
- ✅ Toast normal sin mencionar vouchers
- ✅ No aparecen vouchers en detalle

---

### 9. **Prueba: Click en Imagen para Ampliar**
**Pasos:**
1. Entrar a detalle de contrato con vouchers
2. Click en la imagen de un voucher

**Resultado Esperado:**
- ✅ Se abre la imagen en nueva pestaña (Cloudinary URL)
- ✅ Se puede ver en tamaño completo

---

### 10. **Prueba: Link "Ver detalle completo"**
**Pasos:**
1. Entrar a detalle de contrato con vouchers
2. Click en "Ver detalle completo →"

**Resultado Esperado:**
- ✅ Redirige a `/admin/pagos/:id`
- ✅ Muestra página de detalle del pago
- ✅ Se ven todas las asignaciones a cuotas

---

### 11. **Prueba: Responsive - Mobile**
**Pasos:**
1. Abrir DevTools
2. Cambiar a vista mobile (320px ancho)
3. Crear nueva venta con vouchers
4. Ver detalle del contrato

**Resultado Esperado:**
- ✅ VoucherUploader se adapta a pantalla pequeña
- ✅ Previews se ven en 1 columna
- ✅ En detalle, vouchers se muestran en 1 columna
- ✅ Todo es usable en mobile

---

### 12. **Prueba: Verificar en Módulo Pagos**
**Pasos:**
1. Crear venta con 2 vouchers
2. Ir a panel admin → **Pagos**
3. Buscar los pagos del contrato recién creado

**Resultado Esperado:**
- ✅ Aparecen 2 registros de pago
- ✅ N° Contrato: CTR-2026-XXXXX
- ✅ Propietario: nombre del propietario
- ✅ Notas: "Pago inicial - Voucher subido al crear contrato"
- ✅ Estado: Registrado (verde)
- ✅ Al hacer click en "Ver detalle" se ve la imagen del voucher

---

### 13. **Prueba: Persistencia en Cloudinary**
**Pasos:**
1. Crear venta con 1 voucher
2. Copiar la URL del voucher desde el detalle
3. Abrir la URL en navegador privado (sin sesión)

**Resultado Esperado:**
- ✅ Imagen se carga correctamente (URL pública)
- ✅ URL tiene formato: `https://res.cloudinary.com/.../vouchers/contract_X/...`
- ✅ Imagen permanece aunque se cierre sesión

---

### 14. **Prueba: Error Handling**
**Pasos:**
1. Nueva venta con cuota inicial
2. Subir imagen muy pesada (>10MB si es posible)
3. Registrar venta

**Resultado Esperado:**
- ✅ Si el archivo es demasiado grande, puede fallar
- ✅ Se muestra toast de error descriptivo
- ✅ Venta NO se registra si hay error
- ✅ Usuario puede corregir y reintentar

---

### 15. **Prueba: Historial de Pagos**
**Pasos:**
1. Crear venta con 2 vouchers del pago inicial
2. Ir a detalle del contrato
3. Scrollear hasta "Historial de pagos"

**Resultado Esperado:**
- ✅ Los 2 pagos iniciales aparecen en el historial
- ✅ Fecha, monto, método correcto
- ✅ Estado: Registrado
- ✅ Click "Ver detalle" funciona
- ✅ **Además** aparecen en sección "Vouchers del Pago Inicial"

---

## 🎯 Matriz de Cobertura

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| Subir 1 voucher | ✅ | - |
| Subir múltiples vouchers | ✅ | - |
| No subir vouchers | ✅ | Opcional |
| Eliminar voucher | ✅ | Antes de enviar |
| Validar tipos de archivo | ✅ | Solo img/PDF |
| Preview de imágenes | ✅ | - |
| Preview de PDF | ✅ | Badge "PDF" |
| Conversión Base64 | ✅ | - |
| Subida a Cloudinary | ✅ | - |
| Crear registro Payment | ✅ | - |
| Mostrar en detalle contrato | ✅ | - |
| Toast informativos | ✅ | - |
| Link a detalle de pago | ✅ | - |
| Responsive design | ✅ | - |
| Integración con Pagos | ✅ | - |

---

## 🐛 Bugs Conocidos
**Ninguno reportado hasta el momento.**

---

## 📝 Notas Adicionales

### Cloudinary Configuration
Asegurarse de que el backend tiene configurado:
```python
# backend/.env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

### Datos de Prueba
Usar imágenes de prueba de diferentes formatos:
- JPG: Voucher de banco
- PNG: Captura de transferencia
- PDF: Comprobante electrónico

### Limpiar Datos de Prueba
Después de las pruebas, si deseas limpiar:
```sql
-- Backend database
DELETE FROM payments WHERE notes LIKE '%Voucher subido al crear contrato%';
```

Y en Cloudinary panel, eliminar folder `vouchers/` si es necesario.

---

## ✅ Sign-Off

| Prueba | Probado por | Fecha | Estado |
|--------|-------------|-------|--------|
| 1-5 | - | - | ⏳ Pendiente |
| 6-10 | - | - | ⏳ Pendiente |
| 11-15 | - | - | ⏳ Pendiente |

---

**Última actualización:** 09/09/2026  
**Versión del sistema:** 1.0
