"""
Script de prueba para el módulo de Propietarios y Cobranzas
Ejecutar: python test_owners_module.py
"""
import sys
from datetime import date, timedelta
from decimal import Decimal

# Agregar el directorio padre al path
sys.path.append(".")

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.domain.models import Client, Project, Lot, Block
from app.domain.owners_models import (
    Owner,
    Contract,
    PropertyOwnership,
    FinancingPlan,
    Installment,
    Payment,
)
from app.infrastructure.owners_service import (
    OwnersService,
    ContractsService,
    FinancingService,
    PaymentsService,
    CollectionsService,
)


def test_create_owner(db: Session):
    """Crear un propietario de prueba"""
    print("\n🧪 Test 1: Crear Propietario")
    
    # Primero crear un cliente
    client = Client(
        name="Juan",
        last_name="Pérez García",
        phone="985928062",
        email="juan.perez@example.com"
    )
    db.add(client)
    db.flush()
    
    # Crear propietario
    owner_data = {
        "client_id": client.id,
        "person_type": "natural",
        "document_type": "DNI",
        "document_number": "12345678",
        "first_name": "Juan",
        "paternal_surname": "Pérez",
        "maternal_surname": "García",
        "address": "Av. Principal 123",
        "district": "San Vicente",
        "province": "Cañete",
        "department": "Lima",
    }
    
    owner = OwnersService.create_owner(db, owner_data)
    
    print(f"✅ Propietario creado: {owner.first_name} {owner.paternal_surname}")
    print(f"   Documento: {owner.document_type} {owner.document_number}")
    
    return owner


def test_create_contract_with_financing(db: Session, owner_id: int, project_id: int, lot_id: int):
    """Crear un contrato con financiamiento"""
    print("\n🧪 Test 2: Crear Contrato Financiado")
    
    today = date.today()
    
    contract_data = {
        "owner_id": owner_id,
        "project_id": project_id,
        "lot_id": lot_id,
        "contract_date": today,
        "start_date": today,
        "lot_area_m2": Decimal("150.00"),
        "price_per_m2": Decimal("340.00"),
        "total_price": Decimal("51000.00"),
        "payment_modality": "financiado",
        "status": "activo",
    }
    
    contract = ContractsService.create_contract(db, contract_data)
    
    print(f"✅ Contrato creado: {contract.contract_number}")
    print(f"   Precio total: S/ {contract.total_price}")
    print(f"   Modalidad: {contract.payment_modality}")
    
    # Crear plan de financiamiento
    print("\n📋 Creando plan de financiamiento...")
    
    financing_data = {
        "contract_id": contract.id,
        "total_price": Decimal("51000.00"),
        "initial_payment": Decimal("10000.00"),
        "financed_amount": Decimal("41000.00"),
        "number_of_installments": 36,
        "installment_amount": Decimal("1139.00"),
        "frequency": "mensual",
        "first_installment_date": today + timedelta(days=30),
        "last_installment_date": today + timedelta(days=30*36),
        "interest_rate": Decimal("0.00"),
        "total_interest": Decimal("0.00"),
    }
    
    financing = FinancingService.create_financing_with_schedule(db, financing_data)
    
    print(f"✅ Financiamiento creado")
    print(f"   Inicial: S/ {financing.initial_payment}")
    print(f"   Financiado: S/ {financing.financed_amount}")
    print(f"   Cuotas: {financing.number_of_installments}")
    print(f"   Monto cuota: S/ {financing.installment_amount}")
    
    # Verificar cronograma
    installments = db.query(Installment).filter(
        Installment.financing_plan_id == financing.id
    ).count()
    
    print(f"✅ Cronograma generado: {installments} cuotas")
    
    return contract


def test_register_payment(db: Session, contract_id: int, owner_id: int):
    """Registrar un pago"""
    print("\n🧪 Test 3: Registrar Pago")
    
    payment_data = {
        "contract_id": contract_id,
        "payer_id": owner_id,
        "payment_date": date.today(),
        "amount": Decimal("1139.00"),
        "payment_method": "transferencia",
        "transaction_number": "TRX123456",
        "bank_name": "BCP",
        "notes": "Pago de primera cuota"
    }
    
    payment = PaymentsService.register_payment(db, payment_data)
    
    print(f"✅ Pago registrado: ID {payment.id}")
    print(f"   Monto: S/ {payment.amount}")
    print(f"   Fecha: {payment.payment_date}")
    print(f"   Método: {payment.payment_method}")
    
    # Verificar distribución
    from app.domain.owners_models import PaymentAllocation
    allocations = db.query(PaymentAllocation).filter(
        PaymentAllocation.payment_id == payment.id
    ).all()
    
    print(f"✅ Distribuido a {len(allocations)} cuota(s)")
    for alloc in allocations:
        print(f"   Cuota {alloc.installment.installment_number}: S/ {alloc.allocated_amount}")
    
    return payment


def test_collections_dashboard(db: Session):
    """Obtener dashboard de cobranzas"""
    print("\n🧪 Test 4: Dashboard de Cobranzas")
    
    stats = CollectionsService.get_dashboard_stats(db)
    
    print(f"✅ Estadísticas de cobranzas:")
    print(f"   Cartera total: S/ {stats['total_portfolio']:,.2f}")
    print(f"   Total cobrado: S/ {stats['total_collected']:,.2f}")
    print(f"   Total pendiente: S/ {stats['total_pending']:,.2f}")
    print(f"   Total vencido: S/ {stats['total_overdue']:,.2f}")
    print(f"   Contratos activos: {stats['active_contracts']}")
    print(f"   Contratos con deuda: {stats['overdue_contracts']}")


def test_owner_summary(db: Session, owner_id: int):
    """Obtener resumen del propietario"""
    print("\n🧪 Test 5: Resumen del Propietario")
    
    summary = OwnersService.get_owner_with_summary(db, owner_id)
    
    if summary:
        owner = summary["owner"]
        print(f"✅ Propietario: {owner.first_name} {owner.paternal_surname}")
        print(f"   Propiedades: {summary['total_properties']}")
        print(f"   Total comprado: S/ {summary['total_purchased']:,.2f}")
        print(f"   Total pagado: S/ {summary['total_paid']:,.2f}")
        print(f"   Saldo pendiente: S/ {summary['outstanding_balance']:,.2f}")
        print(f"   Deuda vencida: S/ {summary['overdue_debt']:,.2f}")


def main():
    """Ejecutar todas las pruebas"""
    print("=" * 60)
    print("🧪 PRUEBAS DEL MÓDULO DE PROPIETARIOS Y COBRANZAS")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Obtener un proyecto y lote existente
        project = db.query(Project).first()
        lot = db.query(Lot).filter(Lot.status == "available").first()
        
        if not project or not lot:
            print("❌ Error: No hay proyectos o lotes disponibles")
            print("   Por favor, crea al menos un proyecto y un lote primero")
            return
        
        print(f"\n📌 Usando proyecto: {project.short_name}")
        print(f"📌 Usando lote: {lot.code}")
        
        # Ejecutar pruebas
        owner = test_create_owner(db)
        db.commit()
        
        contract = test_create_contract_with_financing(
            db, owner.id, project.id, lot.id
        )
        db.commit()
        
        payment = test_register_payment(db, contract.id, owner.id)
        db.commit()
        
        test_collections_dashboard(db)
        
        test_owner_summary(db, owner.id)
        
        print("\n" + "=" * 60)
        print("✅ TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE")
        print("=" * 60)
        
        # Preguntar si desea mantener o eliminar los datos de prueba
        response = input("\n¿Desea eliminar los datos de prueba? (s/N): ")
        if response.lower() == "s":
            db.rollback()
            print("🗑️  Datos de prueba eliminados (rollback)")
        else:
            db.commit()
            print("💾 Datos de prueba guardados en la base de datos")
        
    except Exception as e:
        print(f"\n❌ Error durante las pruebas: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
