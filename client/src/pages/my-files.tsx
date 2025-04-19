import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { File } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { FolderCard } from "@/components/ui/folder-card";
import { FileCard } from "@/components/ui/file-card";
import { UploadModal } from "@/components/ui/upload-modal";
import { ShareModal } from "@/components/ui/share-modal";
import { useToast } from "@/hooks/use-toast";
import { formatFileSize } from "@/lib/file-utils";
import { 
  FolderPlus,
  Upload,
  Filter,
  Search,
  Loader2,
  Plus,
  ArrowDownAZ
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MyFiles() {
  const { folderId = null } = useParams<{ folderId: string }>();
  const parentId = folderId ? parseInt(folderId) : null;
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [folderName, setFolderName] = useState("");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState<File | null>(null);
  
  // Fetch files in the current folder
  const { data: files, isLoading } = useQuery<File[]>({
    queryKey: ["/api/files", { parentId }],
  });
  
  // Fetch the current folder info
  const { data: currentFolder } = useQuery<File>({
    queryKey: ["/api/files", parentId],
    enabled: !!parentId,
  });
  
  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/files/folder", {
        name,
        parentId
      });
      return response.json();
    },
    onSuccess: () => {
      setFolderName("");
      setIsCreateFolderOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/files", { parentId }] });
      toast({
        title: "Folder created",
        description: "Your folder has been created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create folder",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete file/folder mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      await apiRequest("DELETE", `/api/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files", { parentId }] });
      toast({
        title: "Deleted",
        description: "The item has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle folder creation
  const handleCreateFolder = () => {
    if (!folderName.trim()) {
      toast({
        title: "Error",
        description: "Folder name cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
    createFolderMutation.mutate(folderName);
  };
  
  // Handle file deletion
  const handleDeleteFile = (fileId: number) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      deleteFileMutation.mutate(fileId);
    }
  };
  
  // Filter and sort files
  const filteredFiles = files?.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  
  // Sort files
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    // Always show folders first
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "size":
        return a.size - b.size;
      case "date":
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      default:
        return 0;
    }
  });
  
  // Separate folders and files
  const folders = sortedFiles.filter(file => file.isFolder);
  const regularFiles = sortedFiles.filter(file => !file.isFolder);
  
  return (
    <DashboardLayout>
      <div className="p-6 flex-1">
        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">
              {parentId ? currentFolder?.name || 'Loading...' : 'My Files'}
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              {parentId ? 'Navigate through your folder' : 'All your files in one secure location'}
            </p>
          </div>
          
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => setIsCreateFolderOpen(true)}
              className="flex items-center"
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              New Folder
            </Button>
            
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>
        
        {/* Folder Navigation */}
        {parentId && (
          <div className="flex items-center space-x-1 text-sm mb-6">
            <Button
              variant="link"
              className="p-0 text-primary-600 hover:text-primary-700"
              onClick={() => navigate('/my-files')}
            >
              My Files
            </Button>
            <span className="text-neutral-500">/</span>
            <span className="text-neutral-500">{currentFolder?.name}</span>
          </div>
        )}
        
        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
            <Input
              placeholder="Search files..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center">
                  <ArrowDownAZ className="w-4 h-4 mr-2" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy("name")}>
                  Name
                  {sortBy === "name" && <Badge className="ml-2">Active</Badge>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("size")}>
                  Size
                  {sortBy === "size" && <Badge className="ml-2">Active</Badge>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("date")}>
                  Date
                  {sortBy === "date" && <Badge className="ml-2">Active</Badge>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button variant="outline" className="flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>
        
        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            {/* Folders Section */}
            {folders.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-medium text-neutral-900 mb-4">Folders</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {folders.map(folder => (
                    <FolderCard 
                      key={folder.id} 
                      folder={folder}
                      onDelete={() => handleDeleteFile(folder.id)}
                      onClick={() => navigate(`/my-files/${folder.id}`)}
                      onShare={() => setFileToShare(folder)}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Files Section */}
            <div>
              <h2 className="text-lg font-medium text-neutral-900 mb-4">Files</h2>
              
              {regularFiles.length > 0 ? (
                <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Last Modified
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Size
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-200">
                      {regularFiles.map(file => (
                        <tr key={file.id} className="hover:bg-neutral-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <FileCard file={file} showActions={false} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-neutral-600">
                              {new Date(file.updatedAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-neutral-600">
                              {formatFileSize(file.size)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-neutral-600">
                              {file.type}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => window.open(`/api/files/${file.id}/download`)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setFileToShare(file)}
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteFile(file.id)}
                              >
                                <Trash className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="bg-neutral-100 p-3 rounded-full mb-4">
                      <Plus className="h-8 w-8 text-neutral-500" />
                    </div>
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No files yet</h3>
                    <p className="text-neutral-500 text-center mb-4">
                      Upload files to start managing your documents
                    </p>
                    <Button onClick={() => setIsUploadModalOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Files
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateFolder}
              disabled={createFolderMutation.isPending}
            >
              {createFolderMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Folder"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Upload Modal */}
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        parentId={parentId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/files", { parentId }] });
        }}
      />
      
      {/* Share Modal */}
      <ShareModal 
        file={fileToShare} 
        isOpen={!!fileToShare} 
        onClose={() => setFileToShare(null)} 
      />
    </DashboardLayout>
  );
}

// Additional imports to satisfy the code
import { Trash, Download } from "lucide-react";
