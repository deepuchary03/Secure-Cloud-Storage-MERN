import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { StatsCard } from "@/components/ui/stats-card";
import { FolderCard } from "@/components/ui/folder-card";
import { FileCard } from "@/components/ui/file-card";
import { File } from "@shared/schema";
import { formatFileSize } from "@/lib/file-utils";
import { 
  FileText,
  FolderOpen,
  Share2,
  HardDrive,
  Clock,
  Loader2
} from "lucide-react";

export default function Dashboard() {
  const [_, navigate] = useLocation();
  
  // Fetch statistics
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/stats"],
  });
  
  // Fetch files at root level (parentId = null)
  const { data: files, isLoading: isLoadingFiles } = useQuery<File[]>({
    queryKey: ["/api/files", { parentId: null }],
  });
  
  // Fetch user's shared files
  const { data: sharedFiles, isLoading: isLoadingShared } = useQuery<File[]>({
    queryKey: ["/api/files/shared"],
  });
  
  const isLoading = isLoadingStats || isLoadingFiles || isLoadingShared;
  
  // Filter files and folders
  const folders = files?.filter(file => file.isFolder) || [];
  const regularFiles = files?.filter(file => !file.isFolder) || [];
  
  // Get recent files (including shared)
  const recentFiles = [...(regularFiles || []), ...(sharedFiles || [])]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  
  return (
    <DashboardLayout>
      <div className="p-6 flex-1">
        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Dashboard</h1>
            <p className="text-sm text-neutral-500 mt-1">Overview of your files and storage</p>
          </div>
        </div>
        
        {/* Quick Stats */}
        {isLoading ? (
          <div className="flex justify-center my-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatsCard 
                title="Total Files"
                value={stats?.fileCount?.toString() || "0"}
                icon={<FileText />}
                bgColor="bg-primary-100"
                iconColor="text-primary-600"
              />
              
              <StatsCard 
                title="Total Folders"
                value={stats?.folderCount?.toString() || "0"}
                icon={<FolderOpen />}
                bgColor="bg-blue-100"
                iconColor="text-blue-600"
              />
              
              <StatsCard 
                title="Storage Used"
                value={formatFileSize(stats?.storageUsed || 0)}
                icon={<HardDrive />}
                bgColor="bg-green-100"
                iconColor="text-green-600"
              />
              
              <StatsCard 
                title="Shared Files"
                value={stats?.sharedFilesCount?.toString() || "0"}
                icon={<Share2 />}
                bgColor="bg-purple-100"
                iconColor="text-purple-600"
              />
            </div>
            
            {/* Recent Activity */}
            <h2 className="text-lg font-medium text-neutral-900 mb-4">Recent Files</h2>
            <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-sm mb-6">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Last Modified</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Size</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Type</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {recentFiles.length > 0 ? (
                    recentFiles.map(file => (
                      <tr 
                        key={file.id} 
                        className="hover:bg-neutral-50 cursor-pointer"
                        onClick={() => navigate(`/my-files/${file.parentId || ""}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <FileCard file={file} showActions={false} />
                          </div>
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
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-neutral-500">
                        No recent files found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Quick Access Folders */}
            <h2 className="text-lg font-medium text-neutral-900 mb-4">My Folders</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {folders.length > 0 ? (
                folders.slice(0, 4).map(folder => (
                  <FolderCard 
                    key={folder.id} 
                    folder={folder} 
                    onClick={() => navigate(`/my-files/${folder.id}`)}
                  />
                ))
              ) : (
                <div className="col-span-4 text-center py-8 bg-white rounded-lg border border-neutral-200">
                  <FolderOpen className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">No folders yet</h3>
                  <p className="text-neutral-500">
                    Create folders to organize your files
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
