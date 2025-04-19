import { useState } from "react";
import { File } from "@shared/schema";
import { Folder, MoreVertical, Trash, Share2 } from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FolderCardProps {
  folder: File;
  onClick?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  className?: string;
}

export function FolderCard({
  folder,
  onClick,
  onDelete,
  onShare,
  className,
}: FolderCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Format date for display
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get file count (stub since we don't have this data directly)
  const getFileCount = () => {
    return "files"; // In a real app, this would show the number of files
  };

  // Stop click propagation on the dropdown menu
  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className={cn(
        "bg-white rounded-lg border border-neutral-200 p-4 hover:shadow-md transition-shadow cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          <div className="bg-neutral-100 p-2 rounded-md">
            <Folder className="w-6 h-6 text-neutral-500" />
          </div>
          <div className="ml-3">
            <h3 className="font-medium text-neutral-900">{folder.name}</h3>
            <p className="text-xs text-neutral-500">{getFileCount()}</p>
          </div>
        </div>
        <div className="relative" onClick={handleDropdownClick}>
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-5 w-5 text-neutral-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onShare && (
                <DropdownMenuItem onClick={onShare}>
                  <Share2 className="mr-2 h-4 w-4" />
                  <span>Share</span>
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={onDelete}
                  className="text-red-500 focus:text-red-500"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="text-xs text-neutral-500 flex items-center justify-between mt-4">
        <span>Updated {formatDate(folder.updatedAt)}</span>
        <span className="px-2 py-1 bg-neutral-100 rounded text-neutral-700">
          {folder.size > 0 ? `${(folder.size / (1024 * 1024)).toFixed(1)} MB` : "-"}
        </span>
      </div>
    </div>
  );
}
