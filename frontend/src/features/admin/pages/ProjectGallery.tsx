import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Image as ImageIcon, Video as VideoIcon, Trash2 } from "lucide-react";
import { api } from "../../../lib/api";
import type { Project } from "../../../types";
import { PageHeader, Button, Card } from "../ui";
import { useToast } from "../../../components/ui/Toast";
import { Skeleton } from "../../../components/ui/Skeleton";
import { FileUploader } from "../../../components/ui/FileUploader";

interface GalleryItem {
  id: number;
  url: string;
  public_id?: string;
  caption?: string;
  category?: string;
  sort_order?: number;
  is_cover?: boolean;
}

interface VideoItem {
  id: number;
  url: string;
  public_id?: string;
  title?: string;
  video_type?: string;
  sort_order?: number;
}

export default function ProjectGallery() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"images" | "videos">("images");

  // Cargar proyecto
  const { data: project } = useQuery({
    queryKey: ["project-gallery", id],
    queryFn: ({ signal }) => api.get<Project>(`/projects/${id}`, false, signal),
  });

  // Cargar galería de imágenes
  const { data: images, isLoading: loadingImages } = useQuery({
    queryKey: ["project-gallery-images", id],
    queryFn: ({ signal }) => api.get<GalleryItem[]>(`/projects/${id}/gallery`, false, signal),
  });

  // Cargar videos
  const { data: videos, isLoading: loadingVideos } = useQuery({
    queryKey: ["project-videos", id],
    queryFn: ({ signal }) => api.get<VideoItem[]>(`/projects/${id}/videos`, false, signal),
  });

  // Agregar imagen a galería
  const addImageMutation = useMutation({
    mutationFn: (data: { project_id: number; url: string; public_id: string; caption?: string; category?: string }) =>
      api.post("/projects/gallery", data, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-gallery-images", id] });
      toast("Imagen agregada a la galería");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  // Agregar video
  const addVideoMutation = useMutation({
    mutationFn: (data: { project_id: number; url: string; public_id?: string; title?: string; video_type?: string }) =>
      api.post("/projects/videos", data, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-videos", id] });
      toast("Video agregado");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  // Eliminar imagen
  const deleteImageMutation = useMutation({
    mutationFn: (imageId: number) => api.del(`/projects/gallery/${imageId}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-gallery-images", id] });
      toast("Imagen eliminada");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  // Eliminar video
  const deleteVideoMutation = useMutation({
    mutationFn: (videoId: number) => api.del(`/projects/videos/${videoId}`, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-videos", id] });
      toast("Video eliminado");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const handleMultipleImagesUpload = (files: Array<{ url: string; publicId: string; filename: string }>) => {
    if (!project) return;

    // Agregar todas las imágenes a la galería
    files.forEach((file) => {
      addImageMutation.mutate({
        project_id: project.id,
        url: file.url,
        public_id: file.publicId,
        caption: file.filename,
        category: "gallery",
      });
    });
  };

  const handleVideoUpload = (url: string, publicId?: string) => {
    if (!project) return;

    addVideoMutation.mutate({
      project_id: project.id,
      url,
      public_id: publicId,
      title: "Video",
      video_type: "promotional",
    });
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
          title={`Galería: ${project?.name || "..."}`}
          subtitle="Gestiona las imágenes y videos de este proyecto que se mostrarán en la web pública"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-netland-light">
        <button
          onClick={() => setActiveTab("images")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "images"
              ? "text-netland-primary border-b-2 border-netland-primary"
              : "text-netland-medium hover:text-netland-dark"
          }`}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Imágenes ({images?.length || 0})
          </div>
        </button>
        <button
          onClick={() => setActiveTab("videos")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "videos"
              ? "text-netland-primary border-b-2 border-netland-primary"
              : "text-netland-medium hover:text-netland-dark"
          }`}
        >
          <div className="flex items-center gap-2">
            <VideoIcon className="h-4 w-4" />
            Videos ({videos?.length || 0})
          </div>
        </button>
      </div>

      {/* Contenido de Imágenes */}
      {activeTab === "images" && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-netland-dark mb-4">
              Subir nuevas imágenes
            </h3>
            <FileUploader
              accept="image/*"
              multiple={true}
              folder={`projects/${project?.slug || id}/gallery`}
              hint="Puedes seleccionar múltiples imágenes. Formatos: JPG, PNG, WEBP"
              onUploadMultipleComplete={handleMultipleImagesUpload}
              maxSizeMB={5}
              preview={false}
            />
          </Card>

          {loadingImages ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : images && images.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image) => (
                <Card key={image.id} className="relative group overflow-hidden">
                  <img
                    src={image.url}
                    alt={image.caption || "Imagen del proyecto"}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      variant="outline"
                      onClick={() => deleteImageMutation.mutate(image.id)}
                      disabled={deleteImageMutation.isPending}
                      className="!px-3 !py-1.5 text-xs bg-white text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                  {image.caption && (
                    <div className="p-2">
                      <p className="text-xs text-netland-medium truncate">
                        {image.caption}
                      </p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <ImageIcon className="h-12 w-12 mx-auto text-netland-light mb-4" />
              <p className="text-netland-medium">
                No hay imágenes en la galería. Sube algunas para comenzar.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Contenido de Videos */}
      {activeTab === "videos" && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-netland-dark mb-4">
              Subir nuevo video
            </h3>
            <FileUploader
              accept="video/*"
              folder={`projects/${project?.slug || id}/videos`}
              hint="Formatos: MP4, WEBM, MOV. Tamaño máximo: 50MB"
              onUploadComplete={handleVideoUpload}
              maxSizeMB={50}
              preview={false}
            />
          </Card>

          {loadingVideos ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : videos && videos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((video) => (
                <Card key={video.id} className="relative group overflow-hidden">
                  <video
                    src={video.url}
                    controls
                    className="w-full h-48 object-cover bg-black"
                  />
                  <div className="p-3 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {video.title && (
                        <p className="text-sm font-medium text-netland-dark truncate">
                          {video.title}
                        </p>
                      )}
                      {video.video_type && (
                        <p className="text-xs text-netland-medium">
                          {video.video_type}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => deleteVideoMutation.mutate(video.id)}
                      disabled={deleteVideoMutation.isPending}
                      className="!px-3 !py-1.5 text-red-600 hover:bg-red-50 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <VideoIcon className="h-12 w-12 mx-auto text-netland-light mb-4" />
              <p className="text-netland-medium">
                No hay videos. Sube algunos para comenzar.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
