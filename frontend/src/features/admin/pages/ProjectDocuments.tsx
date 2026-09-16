import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, FileText, Trash2, ExternalLink } from "lucide-react";
import { api } from "../../../lib/api";
import type { Project } from "../../../types";
import { PageHeader, Button, Card, Field, Input, Select, Textarea } from "../ui";
import { useToast } from "../../../components/ui/Toast";
import { Skeleton } from "../../../components/ui/Skeleton";
import { FileUploader } from "../../../components/ui/FileUploader";

interface DocumentItem {
  id: number;
  name: string;
  category: string;
  url: string;
  description?: string;
  public_id?: string;
}

export default function ProjectDocuments() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast, confirm } = useToast();
  const queryClient = useQueryClient();
  const [documentName, setDocumentName] = useState("");
  const [documentCategory, setDocumentCategory] = useState("brochure");
  const [documentDescription, setDocumentDescription] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");

  // Cargar proyecto
  const { data: project } = useQuery({
    queryKey: ["project-documents", id],
    queryFn: ({ signal }) => api.get<Project>(`/projects/${id}`, false, signal),
  });

  // Cargar documentos
  const { data: documents, isLoading } = useQuery({
    queryKey: ["project-documents-list", id],
    queryFn: ({ signal }) => api.get<DocumentItem[]>(`/projects/${id}/documents`, false, signal),
  });

  // Agregar documento
  const addDocumentMutation = useMutation({
    mutationFn: (data: {
      project_id: number;
      name: string;
      category: string;
      url: string;
      description?: string;
      public_id?: string;
    }) => api.post("/projects/documents", data, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-documents-list", id] });
      toast("Documento agregado");
      // Limpiar formulario
      setDocumentName("");
      setDocumentCategory("brochure");
      setDocumentDescription("");
      setDocumentUrl("");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  // Eliminar documento
  const deleteDocumentMutation = useMutation({
    mutationFn: (docId: number) => api.del(`/projects/documents/${docId}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-documents-list", id] });
      toast("Documento eliminado");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const handleFileUpload = (url: string, _publicId?: string) => {
    setDocumentUrl(url);
  };

  const handleAddDocument = () => {
    if (!project || !documentName || !documentUrl) {
      toast("Completa todos los campos requeridos", "error");
      return;
    }

    addDocumentMutation.mutate({
      project_id: project.id,
      name: documentName,
      category: documentCategory,
      url: documentUrl,
      description: documentDescription,
    });
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      brochure: "Brochure",
      plan: "Plano",
      contract: "Contrato",
      legal: "Legal",
      technical: "Técnico",
      other: "Otro",
    };
    return labels[category] || category;
  };

  if (!id) {
    return <div>Proyecto no encontrado</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate(`/admin/proyectos`)}
          className="flex items-center gap-2 text-netland-medium hover:text-netland-dark mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a proyectos
        </button>

        <PageHeader
          title={`Documentos: ${project?.name || "..."}`}
          subtitle="Gestiona los documentos del proyecto (brochures, planos, contratos)"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario para agregar documento */}
        <Card>
          <h3 className="text-lg font-semibold text-netland-dark mb-4">Agregar documento</h3>

          <div className="space-y-4">
            <Field label="Nombre del documento *">
              <Input
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="Brochure Villa del Sur 2024"
              />
            </Field>

            <Field label="Categoría *">
              <Select
                value={documentCategory}
                onChange={(e) => setDocumentCategory(e.target.value)}
              >
                <option value="brochure">Brochure</option>
                <option value="plan">Plano</option>
                <option value="contract">Contrato</option>
                <option value="legal">Legal</option>
                <option value="technical">Técnico</option>
                <option value="other">Otro</option>
              </Select>
            </Field>

            <Field label="Descripción">
              <Textarea
                rows={3}
                value={documentDescription}
                onChange={(e) => setDocumentDescription(e.target.value)}
                placeholder="Descripción opcional del documento"
              />
            </Field>

            <FileUploader
              label="Subir documento"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              folder={`projects/${project?.slug || id}/documents`}
              hint="Formatos: PDF, DOC, DOCX, XLS, XLSX"
              onUploadComplete={handleFileUpload}
              maxSizeMB={10}
              preview={false}
            />

            {documentUrl && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✓ Archivo subido correctamente
                </p>
              </div>
            )}

            <Button
              onClick={handleAddDocument}
              disabled={addDocumentMutation.isPending || !documentName || !documentUrl}
              className="w-full"
            >
              {addDocumentMutation.isPending ? "Agregando..." : "Agregar documento"}
            </Button>
          </div>
        </Card>

        {/* Lista de documentos */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-netland-dark">
            Documentos del proyecto ({documents?.length || 0})
          </h3>

          {isLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : documents && documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 p-3 bg-netland-light/30 rounded-lg">
                      <FileText className="h-6 w-6 text-netland-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-netland-dark">{doc.name}</h4>
                      <p className="text-sm text-netland-medium mt-1">
                        {getCategoryLabel(doc.category)}
                      </p>
                      {doc.description && (
                        <p className="text-sm text-netland-muted mt-2">{doc.description}</p>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-netland-primary hover:bg-netland-light/30 rounded transition-colors"
                        title="Ver documento"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        onClick={async () => {
                          if (await confirm(`¿Eliminar el documento "${doc.name}"?`)) {
                            deleteDocumentMutation.mutate(doc.id);
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Eliminar documento"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-netland-light mb-4" />
              <p className="text-netland-medium">
                No hay documentos. Agrega algunos para comenzar.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
