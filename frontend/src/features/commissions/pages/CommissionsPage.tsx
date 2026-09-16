import CommissionPaymentList from "../components/CommissionPaymentList";

export default function CommissionsPage() {
  return (
    <CommissionPaymentList
      paymentType="comision"
      title="Comisiones de venta"
      subtitle="Registra y gestiona las comisiones ganadas por los asesores en cada venta."
      createLabel="Nueva comisión"
    />
  );
}