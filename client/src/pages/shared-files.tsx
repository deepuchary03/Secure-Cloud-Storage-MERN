import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { File } from "@shared/schema";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { FileCard } from "@/components/ui/file-card";
import { ShareModal } from "@/components/ui/share-modal";
import { formatFileSize } from "@/lib/file-utils";
import { 
  Search,
  Filter,
  Loader2,
  Share2,
  Download,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function SharedFiles() {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [fileToShare, setFileToShare] = useState<File | null>(null);
  
  // Fetch shared files
  const { data: sharedFiles, isLoading } = useQuery<File[]>({
    queryKey: ["/api/files/shared"],
  });
  
  // Filter files
  const filteredFiles = sharedFiles?.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  
  // Separate folders and files
  const folders = filteredFiles.filter(file => file.isFolder);
  const regularFiles = filteredFiles.filter(file => !file.isFolder);
  
  return (
    <DashboardLayout>
      <div className="p-6 flex-1">
        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Shared with me</h1>
            <p className="text-sm text-neutral-500 mt-1">Files and folders others have shared with you</p>
          </div>
        </div>
        
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
          
          <div className="flex items-center">
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
            {filteredFiles.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="bg-neutral-100 p-3 rounded-full mb-4">
                    <Users className="h-8 w-8 text-neutral-500" />
                  </div>
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">No shared files</h3>
                  <p className="text-neutral-500 text-center">
                    No one has shared any files with you yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Folders Section */}
                {folders.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-lg font-medium text-neutral-900 mb-4">Shared Folders</h2>
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
                              Owner
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-neutral-200">
                          {folders.map(folder => (
                            <tr key={folder.id} className="hover:bg-neutral-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <FileCard file={folder} showActions={false} />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-neutral-600">
                                  {new Date(folder.updatedAt).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-neutral-600">
                                  Shared by User #{folder.ownerId}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setFileToShare(folder)}
                                >
                                  <Share2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* Files Section */}
                {regularFiles.length > 0 && (
                  <div>
                    <h2 className="text-lg font-medium text-neutral-900 mb-4">Shared Files</h2>
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
                              Owner
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
                                  Shared by User #{file.ownerId}
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
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
      
      {/* Share Modal */}
      <ShareModal 
        file={fileToShare} 
        isOpen={!!fileToShare} 
        onClose={() => setFileToShare(null)} 
      />
    </DashboardLayout>
  );
}
