# 🏡 MÓDULO DE PROPIETARIOS Y COBRANZAS - NETLAND

## 📋 Descripción

Módulo completo para la gestión integral de propietarios, contratos, financiamiento, pagos y cobranzas de la Corporación Inmobiliaria Netland.

## 🗄️ Estructura de Base de Datos

### Tablas Principales

#### 1. **owners** - Propietarios
Extiende la tabla `clients` con información adicional específica de propietarios.

- **Campos principales:**
  - `client_id` (FK a clients)
  - `person_type` (natural | juridica)
  - `document_type` (DNI, RUC, CE, PASAPORTE, OTRO)
  - `document_number`
  - `first_name`, `paternal_surname`, `maternal_surname` (persona natural)
  - `business_name` (persona jurídica)
  - `address`, `district`, `province`, `department`
  - `birth_date`
  - `is_active`

#### 2. **contracts** - Contratos de compra-venta
- `contract_number` (único, autoincremental)
- `owner_id` (FK a owners)
- `project_id` (FK a projects)
- `lot_id` (FK a lots)
- `contract_date`, `start_date`
- `lot_area_m2`, `price_per_m2`, `total_price`
- `payment_modality` (contado | financiado)
- `status` (activo | cancelado | resuelto | anulado)
- `contract_pdf_url`

#### 3. **property_ownerships** - Copropiedades
Relación muchos-a-muchos entre propietarios y lotes.
- `owner_id` (FK a owners)
- `lot_id` (FK a lots)
- `contract_id` (FK a contracts)
- `ownership_percentage` (0-100)
- `role` (titular | cotitular | copropietario)

#### 4. **cash_payments** - Pagos al contado
- `contract_id` (FK a contracts, único)
- `total_amount`, `amount_paid`, `balance`
- `payment_date`
- `status` (pagado | pendiente)

#### 5. **financing_plans** - Planes de financiamiento
- `contract_id` (FK a contracts, único)
- `total_price`, `initial_payment`, `financed_amount`
- `number_of_installments`, `installment_amount`
- `frequency` (mensual | quincenal | semanal | personalizada)
- `first_installment_date`, `last_installment_date`
- `interest_rate`, `total_interest`
- `outstanding_balance`

#### 6. **installments** - Cuotas del cronograma
- `financing_plan_id` (FK a financing_plans)
- `installment_number`
- `due_date`, `payment_date`
- `scheduled_amount`, `paid_amount`, `balance`
- `status` (pendiente | pagada | parcial | vencida | anulada)
- `days_overdue`

#### 7. **payments** - Pagos realizados
- `contract_id` (FK a contracts)
- `payer_id` (FK a owners)
- `payment_date`, `amount`
- `payment_method` (efectivo, transferencia, deposito, etc.)
- `transaction_number`, `bank_name`
- `receipt_url`
- `is_cancelled`, `cancelled_at`, `cancellation_reason`

#### 8. **payment_allocations** - Distribución de pagos a cuotas
- `payment_id` (FK a payments)
- `installment_id` (FK a installments)
- `allocated_amount`

#### 9. **contract_documents** - Documentos del contrato
- `contract_id` (FK a contracts)
- `document_name`, `document_type`
- `file_url`, `file_public_id`

#### 10. **import_batches** - Lotes de importación Excel
- `import_type` (owners | contracts | payments)
- `file_name`, `file_url`
- `total_rows`, `successful_rows`, `failed_rows`
- `status` (pending | processing | completed | failed)

#### 11. **import_errors** - Errores de importación
- `batch_id` (FK a import_batches)
- `row_number`, `field_name`
- `error_message`, `row_data`

## 🔗 Relaciones

```
Client (existente)
  ↓
Owner (1:1)
  ↓
Contract (1:N)
  ├── PropertyOwnership (N:M con Lot)
  ├── CashPayment (1:1)
  ├── FinancingPlan (1:1)
  │     ↓
  │   Installment (1:N)
  │     ↓
  │   PaymentAllocation (N:M con Payment)
  ├── Payment (1:N)
  └── ContractDocument (1:N)
```

## 📡 API Endpoints

### Propietarios (`/api/owners`)
- `POST /` - Crear propietario
- `GET /` - Listar propietarios (con filtros)
- `GET /{owner_id}` - Detalle del propietario
- `PUT /{owner_id}` - Actualizar propietario
- `DELETE /{owner_id}` - Eliminar propietario
- `GET /document/{type}/{number}` - Buscar por documento

### Contratos (`/api/contracts`)
- `POST /` - Crear contrato
- `GET /` - Listar contratos (con filtros)
- `GET /{contract_id}` - Detalle del contrato
- `PUT /{contract_id}` - Actualizar contrato
- `DELETE /{contract_id}` - Anular contrato
- `POST /{contract_id}/cash-payment` - Crear pago al contado
- `POST /{contract_id}/financing` - Crear plan de financiamiento
- `GET /{contract_id}/financing` - Obtener plan de financiamiento
- `GET /{contract_id}/schedule` - Obtener cronograma
- `POST /{contract_id}/generate-schedule` - Generar cronograma

### Pagos (`/api/payments`)
- `POST /` - Registrar pago
- `GET /` - Listar pagos (con filtros)
- `GET /{payment_id}` - Detalle del pago
- `PUT /{payment_id}` - Actualizar pago
- `POST /{payment_id}/cancel` - Anular pago
- `GET /history/{contract_id}` - Historial de pagos

### Cobranzas (`/api/collections`)
- `GET /dashboard` - Dashboard de cobranzas
- `GET /items` - Items para cobranza (con filtros)
- `GET /overdue` - Contratos con deuda vencida
- `GET /upcoming` - Próximos vencimientos
- `POST /update-overdue` - Actualizar estados vencidos
- `GET /portfolio-by-project` - Cartera por proyecto
- `GET /statement/{owner_id}` - Estado de cuenta del propietario

## 🎯 Características Principales

### ✅ Implementado

1. **Gestión de Propietarios**
   - Soporte para persona natural y jurídica
   - Validación de documentos únicos
   - Relación con clientes existentes

2. **Copropiedades**
   - Múltiples propietarios por lote
   - Porcentajes de propiedad
   - Roles (titular, cotitular, copropietario)

3. **Contratos**
   - Generación automática de número de contrato
   - Dos modalidades: contado y financiado
   - Estados del contrato (activo, cancelado, resuelto, anulado)
   - Almacenamiento de documentos PDF

4. **Financiamiento**
   - Sin intereses o con intereses
   - Frecuencias: mensual, quincenal, semanal, personalizada
   - Generación automática de cronograma
   - Cálculo automático de saldos

5. **Pagos**
   - Registro de pagos con múltiples métodos
   - Distribución automática o manual a cuotas
   - Pagos parciales
   - Pagos adelantados
   - Anulación de pagos con reversión

6. **Cobranzas**
   - Dashboard con estadísticas
   - Semáforo de estados (al día, próximo a vencer, vencido)
   - Cálculo automático de días de atraso
   - Reportes por proyecto
   - Estados de cuenta

7. **Auditoría**
   - Registro de usuario creador
   - Registro de usuario modificador
   - Timestamps automáticos
   - Trazabilidad completa

8. **Integridad de Datos**
   - Constraints de base de datos
   - Validaciones de negocio
   - Transacciones para operaciones críticas
   - Formas normales 1FN, 2FN, 3FN

### 🔄 Preparado para Futuro

1. **Importación Excel**
   - Estructura de tablas creada
   - Endpoints preparados
   - Validaciones y preview pendientes

2. **Exportación**
   - Endpoints preparados
   - Generación de Excel pendiente

3. **Alertas y Notificaciones**
   - Estructura preparada
   - Integración WhatsApp pendiente

4. **Documentos**
   - Almacenamiento preparado
   - Generación de PDFs pendiente

## 🔧 Uso del Módulo

### Crear un Propietario

```python
POST /api/owners
{
  "client_id": 1,
  "person_type": "natural",
  "document_type": "DNI",
  "document_number": "12345678",
  "first_name": "Juan",
  "paternal_surname": "Pérez",
  "maternal_surname": "García",
  "address": "Av. Principal 123",
  "district": "San Vicente",
  "province": "Cañete",
  "department": "Lima"
}
```

### Crear un Contrato

```python
POST /api/contracts
{
  "owner_id": 1,
  "project_id": 1,
  "lot_id": 10,
  "contract_date": "2026-09-01",
  "start_date": "2026-09-01",
  "lot_area_m2": 150.00,
  "price_per_m2": 340.00,
  "total_price": 51000.00,
  "payment_modality": "financiado",
  "status": "activo"
}
```

### Crear Plan de Financiamiento

```python
POST /api/contracts/1/financing
{
  "contract_id": 1,
  "total_price": 51000.00,
  "initial_payment": 10000.00,
  "financed_amount": 41000.00,
  "number_of_installments": 36,
  "installment_amount": 1139.00,
  "frequency": "mensual",
  "first_installment_date": "2026-10-01",
  "last_installment_date": "2029-09-01",
  "interest_rate": 0.00,
  "total_interest": 0.00,
  "generate_schedule": true
}
```

### Registrar un Pago

```python
POST /api/payments
{
  "contract_id": 1,
  "payer_id": 1,
  "payment_date": "2026-10-01",
  "amount": 1139.00,
  "payment_method": "transferencia",
  "transaction_number": "TRX123456",
  "bank_name": "BCP",
  "notes": "Pago de cuota 1"
}
```

## 📊 Dashboard de Cobranzas

El dashboard proporciona:
- 💰 Cartera total
- ✅ Total cobrado
- ⏳ Total pendiente
- 🔴 Total vencido
- 📅 Cobranzas de hoy
- 📅 Cobranzas del mes
- 📌 Próximos vencimientos (7 días)
- ⚠️ Contratos con deuda vencida
- 📈 Contratos activos

## 🎨 Estados de Cobranza

- 🟢 **AL DÍA**: Sin cuotas vencidas
- 🟡 **PRÓXIMO A VENCER**: Próxima cuota vence en ≤ 7 días
- 🔴 **VENCIDO**: Una o más cuotas vencidas
- ✅ **CANCELADO**: Totalmente pagado

## 📝 Migraciones

Para aplicar las migraciones:

```bash
# Backend
cd backend
alembic upgrade head
```

## 🔐 Seguridad

- Todas las rutas requieren autenticación JWT
- Auditoría de acciones (created_by, updated_by)
- Validación de permisos por rol
- Constraints de integridad referencial
- Validaciones de negocio en servicios

## 🧪 Testing

Pruebas recomendadas:
- Crear propietario con datos válidos/inválidos
- Crear contrato al contado y financiado
- Generar cronograma de pagos
- Registrar pagos (completos, parciales, adelantados)
- Anular pagos y verificar reversión
- Calcular saldos y estados
- Importar datos desde Excel
- Generar reportes

## 📚 Documentación API

La documentación interactiva está disponible en:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## ⚠️ Notas Importantes

1. **NO eliminar propietarios con contratos activos**
2. **Los pagos anulados NO se eliminan**, solo se marcan como `is_cancelled=True`
3. **Los contratos anulados NO se eliminan**, cambian su `status` a "anulado"
4. **El estado del lote se actualiza automáticamente** al crear/anular contrato
5. **Los saldos se calculan automáticamente** al registrar/anular pagos
6. **Las cuotas vencidas se actualizan** ejecutando `POST /api/collections/update-overdue`

## 🚀 Próximos Pasos

1. Implementar importación completa desde Excel
2. Generar plantillas Excel para descarga
3. Implementar exportación a Excel
4. Generar PDFs (contratos, estados de cuenta, cronogramas)
5. Integrar alertas por WhatsApp
6. Crear dashboard visual en frontend
7. Implementar refinanciamiento
8. Implementar reprogramación de cuotas
9. Agregar reportes avanzados
10. Implementar conciliación bancaria

## 👥 Autores

Desarrollado por el equipo de Netland con IA.

## 📄 Licencia

Propiedad de Corporación Inmobiliaria Netland.
