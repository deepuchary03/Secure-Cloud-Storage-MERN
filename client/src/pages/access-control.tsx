import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FilePermission, User, File } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  FileText, 
  Users, 
  User as UserIcon, 
  CheckCircle2, 
  XCircle, 
  Edit, 
  Save, 
  Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function AccessControl() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPermission, setSelectedPermission] = useState<FilePermission | null>(null);
  const [editPermissions, setEditPermissions] = useState({
    canRead: false,
    canWrite: false,
    canDelete: false,
    canShare: false
  });
  
  // Fetch all users
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  
  // Fetch all files
  const { data: files, isLoading: isLoadingFiles } = useQuery<File[]>({
    queryKey: ["/api/files", { parentId: null }],
  });
  
  // Fetch all permissions
  const { data: allPermissions, isLoading: isLoadingPermissions } = useQuery<FilePermission[]>({
    queryKey: ["/api/permissions"],
    queryFn: async () => {
      // Since we don't have a direct API for all permissions, we'll fetch files
      // and then fetch permissions for each file. In a real app, there would be
      // an endpoint to get all permissions.
      
      // This is a simplified version for the demo
      const files = await queryClient.fetchQuery({ queryKey: ["/api/files", { parentId: null }] });
      
      if (!Array.isArray(files) || files.length === 0) {
        return [];
      }
      
      // For simplicity, we'll just get permissions for the first few files
      const firstFewFiles = files.slice(0, 5);
      
      const permissionsPromises = firstFewFiles.map(file => 
        fetch(`/api/files/${file.id}/permissions`, { credentials: "include" })
          .then(res => res.json())
          .catch(() => [])
      );
      
      const permissionsArrays = await Promise.all(permissionsPromises);
      return permissionsArrays.flat();
    },
  });
  
  // Update permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async (data: { id: number, fileId: number, userId: number, permissions: Partial<FilePermission> }) => {
      const response = await apiRequest("POST", `/api/files/${data.fileId}/share`, {
        userId: data.userId,
        ...data.permissions
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Permissions updated",
        description: "The access permissions have been updated successfully",
      });
      setSelectedPermission(null);
      queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
      // Also invalidate specific file permissions
      if (selectedPermission) {
        queryClient.invalidateQueries({ queryKey: ["/api/files", selectedPermission.fileId, "permissions"] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Start editing permissions
  const handleEditPermission = (permission: FilePermission) => {
    setSelectedPermission(permission);
    setEditPermissions({
      canRead: permission.canRead,
      canWrite: permission.canWrite,
      canDelete: permission.canDelete,
      canShare: permission.canShare
    });
  };
  
  // Save updated permissions
  const handleSavePermission = () => {
    if (!selectedPermission) return;
    
    updatePermissionMutation.mutate({
      id: selectedPermission.id,
      fileId: selectedPermission.fileId,
      userId: selectedPermission.userId,
      permissions: editPermissions
    });
  };
  
  // Cancel editing
  const handleCancelEdit = () => {
    setSelectedPermission(null);
  };
  
  // Get user name by ID
  const getUserName = (userId: number) => {
    const user = users?.find(u => u.id === userId);
    return user ? user.name : `User #${userId}`;
  };
  
  // Get file name by ID
  const getFileName = (fileId: number) => {
    const file = files?.find(f => f.id === fileId);
    return file ? file.name : `File #${fileId}`;
  };
  
  // Filter permissions by search query
  const filteredPermissions = allPermissions
    ? allPermissions.filter(permission => {
        const userName = getUserName(permission.userId).toLowerCase();
        const fileName = getFileName(permission.fileId).toLowerCase();
        const query = searchQuery.toLowerCase();
        
        return userName.includes(query) || fileName.includes(query);
      })
    : [];
  
  const isLoading = isLoadingUsers || isLoadingFiles || isLoadingPermissions;
  
  return (
    <DashboardLayout>
      <div className="p-6 flex-1">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Access Control</h1>
            <p className="text-sm text-neutral-500 mt-1">Manage file permissions and user access</p>
          </div>
        </div>
        
        {/* Tabs */}
        <Tabs defaultValue="permissions" className="mb-6">
          <TabsList>
            <TabsTrigger value="permissions">File Permissions</TabsTrigger>
            <TabsTrigger value="roles">User Roles</TabsTrigger>
          </TabsList>
          
          {/* Permissions Tab */}
          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">File Permissions</CardTitle>
                  <div className="relative w-64">
                    <Input
                      placeholder="Search permissions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                      />
                    </svg>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                  </div>
                ) : filteredPermissions.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Read</TableHead>
                          <TableHead>Write</TableHead>
                          <TableHead>Delete</TableHead>
                          <TableHead>Share</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPermissions.map(permission => (
                          <TableRow key={permission.id}>
                            <TableCell>{getFileName(permission.fileId)}</TableCell>
                            <TableCell>{getUserName(permission.userId)}</TableCell>
                            
                            {selectedPermission && selectedPermission.id === permission.id ? (
                              <>
                                <TableCell>
                                  <Switch
                                    checked={editPermissions.canRead}
                                    onCheckedChange={(checked) => setEditPermissions(prev => ({ ...prev, canRead: checked }))}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Switch
                                    checked={editPermissions.canWrite}
                                    onCheckedChange={(checked) => setEditPermissions(prev => ({ ...prev, canWrite: checked }))}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Switch
                                    checked={editPermissions.canDelete}
                                    onCheckedChange={(checked) => setEditPermissions(prev => ({ ...prev, canDelete: checked }))}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Switch
                                    checked={editPermissions.canShare}
                                    onCheckedChange={(checked) => setEditPermissions(prev => ({ ...prev, canShare: checked }))}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={handleSavePermission}
                                      disabled={updatePermissionMutation.isPending}
                                    >
                                      {updatePermissionMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Save className="h-4 w-4 text-green-600" />
                                      )}
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={handleCancelEdit}
                                    >
                                      <XCircle className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell>
                                  {permission.canRead ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  {permission.canWrite ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  {permission.canDelete ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  {permission.canShare ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleEditPermission(permission)}
                                    disabled={!!selectedPermission}
                                  >
                                    <Edit className="h-4 w-4 text-blue-600" />
                                  </Button>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Shield className="h-12 w-12 text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No permissions found</h3>
                    <p className="text-neutral-500 text-center">
                      {searchQuery 
                        ? "No permissions match your search criteria" 
                        : "No file permissions have been set up yet"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Roles Tab */}
          <TabsContent value="roles">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">User Roles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Admin Role */}
                  <div className="p-4 border border-neutral-200 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <Badge className="bg-red-100 text-red-800 mr-2">Admin</Badge>
                        <h3 className="font-medium">Administrator</h3>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-600 mb-4">
                      Full system access with all permissions. Can manage users, files, and system settings.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">User Management</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">File Management</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Access Control</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">System Settings</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Editor Role */}
                  <div className="p-4 border border-neutral-200 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <Badge className="bg-blue-100 text-blue-800 mr-2">Editor</Badge>
                        <h3 className="font-medium">Editor</h3>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-600 mb-4">
                      Can create, edit, and delete their own files, as well as edit shared files.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm">User Management</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">File Management</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">File Sharing</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm">System Settings</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Viewer Role */}
                  <div className="p-4 border border-neutral-200 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <Badge className="bg-green-100 text-green-800 mr-2">Viewer</Badge>
                        <h3 className="font-medium">Viewer</h3>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-600 mb-4">
                      Read-only access to their own files and files shared with them.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm">User Management</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">View Files</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm">Edit Files</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm">Delete Files</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
