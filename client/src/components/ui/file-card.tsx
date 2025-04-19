import { File } from "@shared/schema";
import { 
  FileText, 
  File as FileIcon, 
  Image, 
  Video, 
  Music, 
  Archive, 
  FileSpreadsheet, 
  FilePen,
  Download,
  Share2,
  Trash
} from "lucide-react";
import { formatFileSize } from "@/lib/file-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileCardProps {
  file: File;
  onDownload?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  showActions?: boolean;
  className?: string;
}

export function FileCard({
  file,
  onDownload,
  onDelete,
  onShare,
  showActions = true,
  className,
}: FileCardProps) {
  // Determine file type icon based on mimetype or extension
  const getFileIcon = () => {
    if (file.isFolder) {
      return <FileIcon className="w-5 h-5 text-neutral-700" />;
    }

    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    
    // Documents
    if (type.includes("pdf")) {
      return <FileText className="w-5 h-5 text-red-700" />;
    }
    
    if (type.includes("word") || type.includes("document") || name.endsWith(".doc") || name.endsWith(".docx")) {
      return <FileText className="w-5 h-5 text-blue-700" />;
    }
    
    if (type.includes("excel") || type.includes("spreadsheet") || name.endsWith(".xls") || name.endsWith(".xlsx")) {
      return <FileSpreadsheet className="w-5 h-5 text-green-700" />;
    }
    
    if (type.includes("presentation") || name.endsWith(".ppt") || name.endsWith(".pptx")) {
      return <FilePen className="w-5 h-5 text-orange-700" />;
    }
    
    // Images
    if (type.includes("image")) {
      return <Image className="w-5 h-5 text-blue-700" />;
    }
    
    // Videos
    if (type.includes("video")) {
      return <Video className="w-5 h-5 text-purple-700" />;
    }
    
    // Audio
    if (type.includes("audio")) {
      return <Music className="w-5 h-5 text-pink-700" />;
    }
    
    // Archives
    if (type.includes("zip") || type.includes("tar") || type.includes("rar") || type.includes("archive")) {
      return <Archive className="w-5 h-5 text-yellow-700" />;
    }
    
    // Default
    return <FileText className="w-5 h-5 text-neutral-700" />;
  };

  // Get appropriate background color for file type
  const getBackgroundColor = () => {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    
    if (type.includes("pdf")) return "bg-red-100";
    if (type.includes("word") || type.includes("document") || name.endsWith(".doc") || name.endsWith(".docx")) return "bg-blue-100";
    if (type.includes("excel") || type.includes("spreadsheet") || name.endsWith(".xls") || name.endsWith(".xlsx")) return "bg-green-100";
    if (type.includes("presentation") || name.endsWith(".ppt") || name.endsWith(".pptx")) return "bg-orange-100";
    if (type.includes("image")) return "bg-blue-100";
    if (type.includes("video")) return "bg-purple-100";
    if (type.includes("audio")) return "bg-pink-100";
    if (type.includes("zip") || type.includes("tar") || type.includes("rar") || type.includes("archive")) return "bg-yellow-100";
    
    return "bg-gray-100";
  };

  // Get file type text for display
  const getFileTypeText = () => {
    if (file.isFolder) return "Folder";
    
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    
    if (type.includes("pdf")) return "PDF Document";
    if (type.includes("word") || type.includes("document") || name.endsWith(".doc") || name.endsWith(".docx")) return "Word Document";
    if (type.includes("excel") || type.includes("spreadsheet") || name.endsWith(".xls") || name.endsWith(".xlsx")) return "Excel Spreadsheet";
    if (type.includes("presentation") || name.endsWith(".ppt") || name.endsWith(".pptx")) return "Presentation";
    if (type.includes("image")) return "Image";
    if (type.includes("video")) return "Video";
    if (type.includes("audio")) return "Audio";
    if (type.includes("zip") || type.includes("tar") || type.includes("rar") || type.includes("archive")) return "Archive";
    
    return file.type || "Unknown";
  };

  return (
    <div className={cn("flex items-center w-full", className)}>
      <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg text-white", getBackgroundColor())}>
        {getFileIcon()}
      </div>
      <div className="ml-4 flex-1">
        <div className="text-sm font-medium text-neutral-900">{file.name}</div>
        <div className="text-xs text-neutral-500">{getFileTypeText()}</div>
      </div>
      
      {showActions && (
        <div className="flex items-center space-x-2">
          {onDownload && (
            <Button variant="ghost" size="sm" onClick={onDownload} className="h-8 w-8 p-0">
              <Download className="h-4 w-4 text-neutral-500 hover:text-primary-600" />
            </Button>
          )}
          
          {onShare && (
            <Button variant="ghost" size="sm" onClick={onShare} className="h-8 w-8 p-0">
              <Share2 className="h-4 w-4 text-neutral-500 hover:text-primary-600" />
            </Button>
          )}
          
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0">
              <Trash className="h-4 w-4 text-neutral-500 hover:text-red-600" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
