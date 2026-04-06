import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, FileText, File, Loader2, FileDown } from "lucide-react";

interface DceFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

interface DceUploadSectionProps {
  tenderId: string;
  uploads: DceFile[];
  onUploadsChange: () => void;
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DceUploadSection = ({ tenderId, uploads, onUploadsChange }: DceUploadSectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const downloadFile = async (upload: DceFile) => {
    setDownloadingId(upload.id);
    try {
      const { data, error } = await supabase.storage
        .from("dce-documents")
        .createSignedUrl(upload.file_path, 3600);
      if (error) throw error;

      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = upload.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Erreur de téléchargement", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const uploadFile = async (file: File) => {
    if (!user) return;
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Fichier trop volumineux", description: "Maximum 50 MB", variant: "destructive" });
      return;
    }

    const allowed = ["application/pdf", "application/zip", "application/x-zip-compressed",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|zip|docx|doc)$/i)) {
      toast({ title: "Format non supporté", description: "PDF, ZIP ou DOCX uniquement", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const filePath = `${user.id}/${tenderId}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage
        .from("dce-documents")
        .upload(filePath, file);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from("dce_uploads").insert({
        tender_id: tenderId,
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
      });

      if (dbError) throw dbError;

      toast({ title: "Document uploadé ✓" });
      onUploadsChange();
    } catch (err: any) {
      toast({ title: "Erreur d'upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (upload: DceFile) => {
    try {
      await supabase.storage.from("dce-documents").remove([upload.file_path]);
      await supabase.from("dce_uploads").delete().eq("id", upload.id);
      toast({ title: "Document supprimé" });
      onUploadsChange();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  }, [user, tenderId]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) Array.from(files).forEach(uploadFile);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documents de consultation (DCE)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("dce-file-input")?.click()}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Upload en cours...</span>
            </div>
          ) : (
            <div className="space-y-1">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Glissez vos fichiers ici ou <span className="text-primary">parcourir</span>
              </p>
              <p className="text-xs text-muted-foreground">PDF, ZIP, DOCX — max 50 MB</p>
            </div>
          )}
          <input
            id="dce-file-input"
            type="file"
            className="hidden"
            accept=".pdf,.zip,.docx,.doc"
            multiple
            onChange={handleFileInput}
          />
        </div>

        {/* Uploaded files */}
        {uploads.length > 0 && (
          <div className="space-y-2">
            {uploads.map((upload) => (
              <div key={upload.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/50 text-sm">
                <button
                  className="flex items-center gap-2 min-w-0 hover:underline text-left"
                  onClick={() => downloadFile(upload)}
                  disabled={downloadingId === upload.id}
                >
                  {downloadingId === upload.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                  ) : (
                    <File className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate text-primary">{upload.file_name}</span>
                  {upload.file_size && (
                    <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(upload.file_size)}</span>
                  )}
                </button>
                <div className="flex items-center shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadFile(upload)} disabled={downloadingId === upload.id}>
                    <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteFile(upload)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DceUploadSection;
