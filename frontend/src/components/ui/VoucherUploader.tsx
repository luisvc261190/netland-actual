import { useState } from "react";
import { Upload, X, Calendar, DollarSign } from "lucide-react";
import { Input } from "../../features/admin/ui";

export interface VoucherFile {
  id: string;
  file: File;
  amount: string;
  date: string;
  preview: string;
}

interface VoucherUploaderProps {
  vouchers: VoucherFile[];
  onChange: (vouchers: VoucherFile[]) => void;
  totalAmount?: number;
  label?: string;
  description?: string;
}

export function VoucherUploader({
  vouchers,
  onChange,
  totalAmount,
  label = "Vouchers de Pago",
  description = "Puedes subir varios vouchers si el pago se realizó en partes",
}: VoucherUploaderProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files: FileList) => {
    const validFiles = Array.from(files).filter((file) => {
      const isImage = file.type.startsWith("image/");
      const isPDF = file.type === "application/pdf";
      return isImage || isPDF;
    });

    if (validFiles.length === 0) {
      alert("Solo se permiten imágenes (JPG, PNG, etc.) o archivos PDF");
      return;
    }

    const newVouchers: VoucherFile[] = validFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      amount: "",
      date: new Date().toISOString().split("T")[0],
      preview: URL.createObjectURL(file),
    }));

    onChange([...vouchers, ...newVouchers]);
  };

  const removeVoucher = (id: string) => {
    const voucher = vouchers.find((v) => v.id === id);
    if (voucher?.preview) {
      URL.revokeObjectURL(voucher.preview);
    }
    onChange(vouchers.filter((v) => v.id !== id));
  };

  const updateVoucher = (id: string, field: "amount" | "date", value: string) => {
    onChange(
      vouchers.map((v) =>
        v.id === id ? { ...v, [field]: value } : v
      )
    );
  };

  const totalDocumented = vouchers.reduce(
    (sum, v) => sum + (parseFloat(v.amount) || 0),
    0
  );

  const isComplete = totalAmount && totalDocumented >= totalAmount;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <label className="block text-sm font-medium text-netland-dark mb-1">
            {label}
          </label>
          <p className="text-xs text-netland-muted">{description}</p>
        </div>
        {totalAmount && (
          <div className="text-right">
            <p className="text-xs text-netland-muted">Total documentado</p>
            <p
              className={`text-sm font-semibold ${
                isComplete ? "text-green-600" : "text-netland-primary"
              }`}
            >
              S/ {totalDocumented.toFixed(2)} / S/ {totalAmount.toFixed(2)}
              {isComplete && " ✓"}
            </p>
          </div>
        )}
      </div>

      {/* Upload Area */}
      <div
        className={`relative rounded-lg border-2 border-dashed transition-colors ${
          dragActive
            ? "border-netland-primary bg-netland-light/50"
            : "border-netland-muted/30 bg-white"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="p-6 text-center">
          <Upload className="mx-auto h-8 w-8 text-netland-muted mb-2" />
          <p className="text-sm text-netland-dark font-medium mb-1">
            Arrastra archivos aquí o haz clic para seleccionar
          </p>
          <p className="text-xs text-netland-muted">
            Imágenes (JPG, PNG) o PDF • Máximo 10 MB por archivo
          </p>
        </div>
      </div>

      {/* Vouchers List */}
      {vouchers.length > 0 && (
        <div className="space-y-3">
          {vouchers.map((voucher) => (
            <div
              key={voucher.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-netland-muted/30 bg-white"
            >
              {/* Preview */}
              <div className="flex-shrink-0">
                {voucher.file.type === "application/pdf" ? (
                  <div className="w-16 h-16 rounded bg-red-100 flex items-center justify-center">
                    <span className="text-xs font-semibold text-red-600">PDF</span>
                  </div>
                ) : (
                  <img
                    src={voucher.preview}
                    alt="Preview"
                    className="w-16 h-16 rounded object-cover border border-netland-muted/20"
                  />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-netland-dark truncate">
                      {voucher.file.name}
                    </p>
                    <p className="text-xs text-netland-muted">
                      {(voucher.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVoucher(voucher.id)}
                    className="flex-shrink-0 p-1 rounded hover:bg-red-50 text-netland-muted hover:text-red-600 transition-colors"
                    title="Eliminar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-netland-muted pointer-events-none" />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Monto"
                      value={voucher.amount}
                      onChange={(e) =>
                        updateVoucher(voucher.id, "amount", e.target.value)
                      }
                      className="!pl-8 !text-sm !py-1.5"
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-netland-muted pointer-events-none" />
                    <Input
                      type="date"
                      value={voucher.date}
                      onChange={(e) =>
                        updateVoucher(voucher.id, "date", e.target.value)
                      }
                      className="!pl-8 !text-sm !py-1.5"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
