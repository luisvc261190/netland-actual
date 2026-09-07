-- ============================================================================
-- EJEMPLOS SQL PARA EL MÓDULO DE PROPIETARIOS Y COBRANZAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CREAR UN PROPIETARIO (Persona Natural)
-- ----------------------------------------------------------------------------
-- Primero crear el cliente si no existe
INSERT INTO clients (name, last_name, phone, email, created_at)
VALUES ('Juan', 'Pérez García', '985928062', 'juan.perez@example.com', NOW())
RETURNING id;
-- Supongamos que retorna id = 1

-- Luego crear el propietario
INSERT INTO owners (
    client_id, person_type, document_type, document_number,
    first_name, paternal_surname, maternal_surname,
    address, district, province, department,
    is_active, created_at
)
VALUES (
    1, 'natural', 'DNI', '12345678',
    'Juan', 'Pérez', 'García',
    'Av. Principal 123', 'San Vicente', 'Cañete', 'Lima',
    true, NOW()
)
RETURNING id;
-- Supongamos que retorna id = 1

-- ----------------------------------------------------------------------------
-- 2. CREAR UN CONTRATO FINANCIADO
-- ----------------------------------------------------------------------------
INSERT INTO contracts (
    contract_number, owner_id, project_id, lot_id,
    contract_date, start_date,
    lot_area_m2, price_per_m2, total_price,
    payment_modality, status,
    created_at
)
VALUES (
    'CTR-2026-00001', 1, 1, 10,
    '2026-09-01', '2026-09-01',
    150.00, 340.00, 51000.00,
    'financiado', 'activo',
    NOW()
)
RETURNING id;
-- Supongamos que retorna id = 1

-- Crear la propiedad (ownership)
INSERT INTO property_ownerships (
    owner_id, lot_id, contract_id,
    ownership_percentage, role,
    created_at
)
VALUES (
    1, 10, 1,
    100.00, 'titular',
    NOW()
);

-- Actualizar estado del lote
UPDATE lots SET status = 'sold' WHERE id = 10;

-- ----------------------------------------------------------------------------
-- 3. CREAR PLAN DE FINANCIAMIENTO
-- ----------------------------------------------------------------------------
INSERT INTO financing_plans (
    contract_id, total_price, initial_payment, financed_amount,
    number_of_installments, installment_amount, frequency,
    first_installment_date, last_installment_date,
    interest_rate, total_interest, outstanding_balance,
    created_at
)
VALUES (
    1, 51000.00, 10000.00, 41000.00,
    36, 1139.00, 'mensual',
    '2026-10-01', '2029-09-01',
    0.00, 0.00, 41000.00,
    NOW()
)
RETURNING id;
-- Supongamos que retorna id = 1

-- ----------------------------------------------------------------------------
-- 4. GENERAR CRONOGRAMA DE PAGOS (Primeras 3 cuotas)
-- ----------------------------------------------------------------------------
INSERT INTO installments (
    financing_plan_id, installment_number, due_date,
    scheduled_amount, paid_amount, balance,
    status, days_overdue, created_at
)
VALUES
    (1, 1, '2026-10-01', 1139.00, 0.00, 1139.00, 'pendiente', 0, NOW()),
    (1, 2, '2026-11-01', 1139.00, 0.00, 1139.00, 'pendiente', 0, NOW()),
    (1, 3, '2026-12-01', 1139.00, 0.00, 1139.00, 'pendiente', 0, NOW());
-- Continuar hasta la cuota 36...

-- ----------------------------------------------------------------------------
-- 5. REGISTRAR UN PAGO
-- ----------------------------------------------------------------------------
INSERT INTO payments (
    contract_id, payer_id, payment_date, amount,
    payment_method, transaction_number, bank_name,
    notes, is_cancelled, created_at
)
VALUES (
    1, 1, '2026-10-01', 1139.00,
    'transferencia', 'TRX123456', 'BCP',
    'Pago de primera cuota', false, NOW()
)
RETURNING id;
-- Supongamos que retorna id = 1

-- Distribuir el pago a la cuota 1
INSERT INTO payment_allocations (
    payment_id, installment_id, allocated_amount, created_at
)
VALUES (
    1, 1, 1139.00, NOW()
);

-- Actualizar la cuota 1
UPDATE installments
SET paid_amount = 1139.00,
    balance = 0.00,
    status = 'pagada',
    payment_date = '2026-10-01'
WHERE id = 1;

-- Actualizar el saldo del financiamiento
UPDATE financing_plans
SET outstanding_balance = outstanding_balance - 1139.00
WHERE id = 1;

-- ----------------------------------------------------------------------------
-- 6. CONSULTAS ÚTILES
-- ----------------------------------------------------------------------------

-- Obtener todos los contratos activos con propietario y proyecto
SELECT 
    c.contract_number,
    CONCAT(o.first_name, ' ', o.paternal_surname) as owner_name,
    o.document_number,
    p.short_name as project_name,
    l.code as lot_code,
    c.payment_modality,
    c.total_price,
    c.status
FROM contracts c
JOIN owners o ON c.owner_id = o.id
JOIN projects p ON c.project_id = p.id
JOIN lots l ON c.lot_id = l.id
WHERE c.status = 'activo'
ORDER BY c.created_at DESC;

-- Obtener cartera pendiente por proyecto
SELECT 
    p.short_name as project,
    COUNT(c.id) as total_contracts,
    SUM(fp.financed_amount) as total_financed,
    SUM(fp.outstanding_balance) as total_outstanding
FROM projects p
LEFT JOIN contracts c ON p.id = c.project_id AND c.status = 'activo' AND c.payment_modality = 'financiado'
LEFT JOIN financing_plans fp ON c.id = fp.contract_id
GROUP BY p.id, p.short_name
ORDER BY total_outstanding DESC;

-- Obtener cuotas vencidas
SELECT 
    c.contract_number,
    CONCAT(o.first_name, ' ', o.paternal_surname) as owner_name,
    i.installment_number,
    i.due_date,
    i.scheduled_amount,
    i.balance,
    i.days_overdue,
    p.short_name as project_name
FROM installments i
JOIN financing_plans fp ON i.financing_plan_id = fp.id
JOIN contracts c ON fp.contract_id = c.id
JOIN owners o ON c.owner_id = o.id
JOIN projects p ON c.project_id = p.id
WHERE i.status = 'vencida'
ORDER BY i.days_overdue DESC, i.due_date ASC;

-- Obtener historial de pagos de un contrato
SELECT 
    p.payment_date,
    p.amount,
    p.payment_method,
    p.transaction_number,
    p.is_cancelled,
    STRING_AGG(CONCAT('Cuota ', i.installment_number), ', ') as cuotas_aplicadas
FROM payments p
LEFT JOIN payment_allocations pa ON p.id = pa.payment_id
LEFT JOIN installments i ON pa.installment_id = i.id
WHERE p.contract_id = 1
GROUP BY p.id, p.payment_date, p.amount, p.payment_method, p.transaction_number, p.is_cancelled
ORDER BY p.payment_date DESC;

-- Calcular total pagado y saldo de un contrato
SELECT 
    c.contract_number,
    c.total_price,
    c.payment_modality,
    CASE 
        WHEN c.payment_modality = 'contado' THEN cp.amount_paid
        ELSE (fp.financed_amount - fp.outstanding_balance)
    END as total_paid,
    CASE 
        WHEN c.payment_modality = 'contado' THEN cp.balance
        ELSE fp.outstanding_balance
    END as outstanding_balance
FROM contracts c
LEFT JOIN cash_payments cp ON c.id = cp.contract_id
LEFT JOIN financing_plans fp ON c.id = fp.contract_id
WHERE c.id = 1;

-- Obtener próximos vencimientos (7 días)
SELECT 
    c.contract_number,
    CONCAT(o.first_name, ' ', o.paternal_surname) as owner_name,
    o.document_number,
    cl.phone as owner_phone,
    i.installment_number,
    i.due_date,
    i.scheduled_amount,
    (i.due_date - CURRENT_DATE) as days_until_due,
    p.short_name as project_name
FROM installments i
JOIN financing_plans fp ON i.financing_plan_id = fp.id
JOIN contracts c ON fp.contract_id = c.id
JOIN owners o ON c.owner_id = o.id
JOIN clients cl ON o.client_id = cl.id
JOIN projects p ON c.project_id = p.id
WHERE i.status IN ('pendiente', 'parcial')
  AND i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY i.due_date ASC;

-- Estado de cuenta de un propietario
SELECT 
    o.id,
    CONCAT(o.first_name, ' ', o.paternal_surname) as owner_name,
    o.document_type || ' ' || o.document_number as document,
    COUNT(DISTINCT c.id) as total_contracts,
    SUM(c.total_price) as total_purchased,
    SUM(
        CASE 
            WHEN c.payment_modality = 'contado' THEN COALESCE(cp.amount_paid, 0)
            ELSE COALESCE(fp.financed_amount - fp.outstanding_balance, 0)
        END
    ) as total_paid,
    SUM(
        CASE 
            WHEN c.payment_modality = 'contado' THEN COALESCE(cp.balance, 0)
            ELSE COALESCE(fp.outstanding_balance, 0)
        END
    ) as outstanding_balance
FROM owners o
LEFT JOIN contracts c ON o.id = c.owner_id AND c.status = 'activo'
LEFT JOIN cash_payments cp ON c.id = cp.contract_id
LEFT JOIN financing_plans fp ON c.id = fp.contract_id
WHERE o.id = 1
GROUP BY o.id, o.first_name, o.paternal_surname, o.document_type, o.document_number;

-- Validar integridad de porcentajes de copropiedad
SELECT 
    contract_id,
    COUNT(*) as num_owners,
    SUM(ownership_percentage) as total_percentage
FROM property_ownerships
GROUP BY contract_id
HAVING SUM(ownership_percentage) <> 100.00;
-- Debe retornar 0 filas (todos los contratos deben sumar 100%)

-- Verificar distribución correcta de pagos
SELECT 
    p.id as payment_id,
    p.amount as payment_amount,
    SUM(pa.allocated_amount) as total_allocated
FROM payments p
LEFT JOIN payment_allocations pa ON p.id = pa.payment_id
WHERE p.is_cancelled = false
GROUP BY p.id, p.amount
HAVING p.amount <> COALESCE(SUM(pa.allocated_amount), 0);
-- Debe retornar 0 filas (todos los pagos deben estar completamente distribuidos)

-- ----------------------------------------------------------------------------
-- 7. ACTUALIZAR ESTADOS VENCIDOS
-- ----------------------------------------------------------------------------
UPDATE installments
SET 
    status = 'vencida',
    days_overdue = CURRENT_DATE - due_date
WHERE status IN ('pendiente', 'parcial')
  AND due_date < CURRENT_DATE
  AND balance > 0;

-- ----------------------------------------------------------------------------
-- 8. ANULAR UN PAGO (Ejemplo)
-- ----------------------------------------------------------------------------
-- Revertir distribuciones
UPDATE installments i
SET 
    paid_amount = paid_amount - pa.allocated_amount,
    balance = balance + pa.allocated_amount,
    status = CASE 
        WHEN (paid_amount - pa.allocated_amount) = 0 THEN 'pendiente'
        WHEN (paid_amount - pa.allocated_amount) > 0 THEN 'parcial'
        ELSE status
    END
FROM payment_allocations pa
WHERE pa.installment_id = i.id
  AND pa.payment_id = 1;  -- ID del pago a anular

-- Revertir saldo del financiamiento
UPDATE financing_plans fp
SET outstanding_balance = outstanding_balance + (
    SELECT SUM(allocated_amount)
    FROM payment_allocations pa
    WHERE pa.payment_id = 1
)
WHERE EXISTS (
    SELECT 1
    FROM payment_allocations pa
    JOIN installments i ON pa.installment_id = i.id
    WHERE pa.payment_id = 1
      AND i.financing_plan_id = fp.id
);

-- Marcar pago como anulado
UPDATE payments
SET 
    is_cancelled = true,
    cancelled_at = NOW(),
    cancellation_reason = 'Anulación por error en el monto'
WHERE id = 1;

-- ----------------------------------------------------------------------------
-- FIN DE EJEMPLOS
-- ----------------------------------------------------------------------------
