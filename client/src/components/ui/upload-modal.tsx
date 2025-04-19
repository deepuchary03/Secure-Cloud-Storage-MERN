import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Paperclip, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: number | null;
  onSuccess?: () => void;
}

export function UploadModal({
  isOpen,
  onClose,
  parentId,
  onSuccess
}: UploadModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [access, setAccess] = useState<string>("private");
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (parentId !== null) {
        formData.append("parentId", parentId.toString());
      }
      
      // Simulating progress for better UX
      // In a real app, you'd use fetch with progress events
      const simulateProgress = () => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 10;
          if (progress > 95) {
            clearInterval(interval);
            progress = 95;
          }
          setUploadProgress(Math.min(progress, 95));
        }, 300);
        
        return () => clearInterval(interval);
      };
      
      const cleanup = simulateProgress();
      
      try {
        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        
        if (!response.ok) {
          throw new Error("Upload failed");
        }
        
        cleanup();
        setUploadProgress(100);
        return await response.json();
      } catch (error) {
        cleanup();
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "File uploaded",
        description: "Your file has been uploaded successfully",
      });
      setSelectedFiles([]);
      setUploadProgress(0);
      if (onSuccess) {
        onSuccess();
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    },
    onError: (error: Error) => {
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles(files);
    }
  };

  // Handle file selection via input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
    }
  };

  // Handle upload button click
  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      uploadMutation.mutate(selectedFiles[0]);
    }
  };

  // Open file browser
  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Remove selected file
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Check if form is valid
  const isValid = selectedFiles.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
        </DialogHeader>
        
        {uploadMutation.isPending ? (
          <div className="py-6 space-y-4">
            <p className="text-sm text-neutral-600">Uploading {selectedFiles[0]?.name}...</p>
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-neutral-500 text-right">{Math.round(uploadProgress)}%</p>
          </div>
        ) : (
          <>
            <div 
              className={cn(
                "border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center mb-4 transition-colors",
                isDragging && "border-primary-500 bg-primary-50"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <p className="text-neutral-700 mb-2">Drag and drop files here or</p>
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handleBrowseClick}
              >
                Browse Files
              </Button>
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                onChange={handleFileChange}
              />
              <p className="text-xs text-neutral-500 mt-2">Maximum file size: 100MB</p>
            </div>
            
            {selectedFiles.length > 0 && (
              <div className="mb-4 border border-neutral-200 rounded-md divide-y">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3">
                    <div className="flex items-center">
                      <Paperclip className="w-4 h-4 text-neutral-500 mr-2" />
                      <div>
                        <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-neutral-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0" 
                      onClick={() => handleRemoveFile(index)}
                    >
                      <X className="w-4 h-4 text-neutral-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Access Control
              </label>
              <Select value={access} onValueChange={setAccess}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private (Only me)</SelectItem>
                  <SelectItem value="shared">Shared (Select specific users)</SelectItem>
                  <SelectItem value="public">Public (Anyone with link)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <DialogFooter className="flex justify-end space-x-3">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={uploadMutation.isPending}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!isValid || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? "Uploading..." : "Upload Files"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
