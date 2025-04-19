import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { File, User, FilePermission } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Share2, Users, Check, Trash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FileCard } from "./file-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ShareModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
}

const shareFormSchema = z.object({
  userId: z.string().min(1, "User is required"),
  canRead: z.boolean().default(true),
  canWrite: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canShare: z.boolean().default(false),
});

export function ShareModal({ file, isOpen, onClose }: ShareModalProps) {
  const { toast } = useToast();
  const [sharingLoading, setSharingLoading] = useState(false);
  
  // Fetch users to share with
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isOpen,
  });
  
  // Fetch current permissions for this file
  const { data: permissions, isLoading: isLoadingPermissions } = useQuery<FilePermission[]>({
    queryKey: ["/api/files", file?.id, "permissions"],
    enabled: isOpen && !!file,
  });
  
  // Form for sharing
  const form = useForm<z.infer<typeof shareFormSchema>>({
    resolver: zodResolver(shareFormSchema),
    defaultValues: {
      userId: "",
      canRead: true,
      canWrite: false,
      canDelete: false,
      canShare: false,
    },
  });
  
  // Reset form when modal is opened/closed
  useEffect(() => {
    if (isOpen) {
      form.reset({
        userId: "",
        canRead: true,
        canWrite: false,
        canDelete: false,
        canShare: false,
      });
    }
  }, [isOpen, form]);
  
  // Share mutation
  const shareMutation = useMutation({
    mutationFn: async (data: z.infer<typeof shareFormSchema>) => {
      if (!file) throw new Error("No file selected");
      
      const response = await apiRequest("POST", `/api/files/${file.id}/share`, {
        userId: parseInt(data.userId),
        canRead: data.canRead,
        canWrite: data.canWrite,
        canDelete: data.canDelete,
        canShare: data.canShare,
      });
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "File shared",
        description: "The file has been shared successfully",
      });
      form.reset({
        userId: "",
        canRead: true,
        canWrite: false,
        canDelete: false,
        canShare: false,
      });
      // Refresh permissions
      queryClient.invalidateQueries({ queryKey: ["/api/files", file?.id, "permissions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sharing failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Revoke access mutation
  const revokeMutation = useMutation({
    mutationFn: async (userId: number) => {
      if (!file) throw new Error("No file selected");
      
      await apiRequest("DELETE", `/api/files/${file.id}/share/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "Access revoked",
        description: "Access has been revoked successfully",
      });
      // Refresh permissions
      queryClient.invalidateQueries({ queryKey: ["/api/files", file?.id, "permissions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to revoke access",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle share form submission
  const onSubmit = (data: z.infer<typeof shareFormSchema>) => {
    shareMutation.mutate(data);
  };
  
  // Handle revoking access
  const handleRevokeAccess = (userId: number) => {
    if (window.confirm("Are you sure you want to revoke access for this user?")) {
      revokeMutation.mutate(userId);
    }
  };
  
  // Find user name by ID
  const getUserName = (userId: number) => {
    const user = users?.find(u => u.id === userId);
    return user ? user.name : `User #${userId}`;
  };
  
  const isLoading = isLoadingUsers || isLoadingPermissions || shareMutation.isPending || revokeMutation.isPending;
  
  if (!file) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <div className="mb-4 p-3 bg-neutral-50 border border-neutral-200 rounded-md">
            <FileCard file={file} showActions={false} />
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Share with user</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingUsers ? (
                          <div className="flex items-center justify-center p-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : (
                          users?.map(user => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="space-y-3 border-t border-b py-3 border-neutral-200">
                <FormField
                  control={form.control}
                  name="canRead"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <FormLabel>Read access</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="canWrite"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <FormLabel>Write access</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="canDelete"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <FormLabel>Delete access</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="canShare"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <FormLabel>Share access</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={!form.formState.isValid || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sharing...
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
          
          {/* Existing Shares Table */}
          {permissions && permissions.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Currently shared with</h3>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permissions.map(permission => (
                      <TableRow key={permission.id}>
                        <TableCell>{getUserName(permission.userId)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {permission.canRead && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                Read
                              </span>
                            )}
                            {permission.canWrite && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                Write
                              </span>
                            )}
                            {permission.canDelete && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                                Delete
                              </span>
                            )}
                            {permission.canShare && (
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                Share
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeAccess(permission.userId)}
                            disabled={revokeMutation.isPending}
                          >
                            <Trash className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
