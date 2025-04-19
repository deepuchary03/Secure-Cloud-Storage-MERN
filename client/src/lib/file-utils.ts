import { File } from "@shared/schema";

// This will format the file size to human-readable format
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Format date to a human-readable format
export function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  return new Date(date).toLocaleDateString(undefined, options);
}

// Get file type icon based on mimetype or extension
export function getFileTypeIcon(file: File): { bgColor: string; icon: string } {
  if (file.isFolder) {
    return {
      bgColor: "bg-neutral-100",
      icon: "folder",
    };
  }

  const type = file.type.toLowerCase();
  
  // Documents
  if (type.includes("pdf")) {
    return {
      bgColor: "bg-red-100",
      icon: "file-text",
    };
  }
  
  if (type.includes("word") || type.includes("document") || file.name.endsWith(".doc") || file.name.endsWith(".docx")) {
    return {
      bgColor: "bg-blue-100",
      icon: "file-text",
    };
  }
  
  if (type.includes("excel") || type.includes("spreadsheet") || file.name.endsWith(".xls") || file.name.endsWith(".xlsx")) {
    return {
      bgColor: "bg-green-100",
      icon: "file-spreadsheet",
    };
  }
  
  if (type.includes("presentation") || file.name.endsWith(".ppt") || file.name.endsWith(".pptx")) {
    return {
      bgColor: "bg-orange-100",
      icon: "file-presentation",
    };
  }
  
  // Images
  if (type.includes("image")) {
    return {
      bgColor: "bg-blue-100",
      icon: "image",
    };
  }
  
  // Videos
  if (type.includes("video")) {
    return {
      bgColor: "bg-purple-100",
      icon: "video",
    };
  }
  
  // Audio
  if (type.includes("audio")) {
    return {
      bgColor: "bg-pink-100",
      icon: "music",
    };
  }
  
  // Archives
  if (type.includes("zip") || type.includes("tar") || type.includes("rar") || type.includes("archive")) {
    return {
      bgColor: "bg-yellow-100",
      icon: "archive",
    };
  }
  
  // Default
  return {
    bgColor: "bg-gray-100",
    icon: "file",
  };
}

// Get breadcrumb paths
export async function getBreadcrumbPaths(fileId: number | null, storage: any): Promise<{id: number | null, name: string}[]> {
  if (!fileId) {
    return [{ id: null, name: "My Files" }];
  }

  const result: {id: number | null, name: string}[] = [];
  let currentId: number | null = fileId;

  while (currentId !== null) {
    const file = await storage.getFile(currentId);
    if (!file) break;
    
    result.unshift({ id: file.id, name: file.name });
    currentId = file.parentId;
  }

  if (result.length === 0 || result[0].id !== null) {
    result.unshift({ id: null, name: "My Files" });
  }

  return result;
}
