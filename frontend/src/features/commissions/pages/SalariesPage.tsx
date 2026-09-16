import CommissionPaymentList from "../components/CommissionPaymentList";

export default function SalariesPage() {
  return (
    <CommissionPaymentList
      paymentType="mensualidad"
      title="Mensualidades"
      subtitle="Gestiona el pago de las mensualidades (sueldos) de cada asesor."
      createLabel="Nueva mensualidad"
    />
  );
}