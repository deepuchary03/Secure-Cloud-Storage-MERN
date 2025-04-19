import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { User, UserRole, insertUserSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  UserPlus,
  Loader2,
  Edit,
  Trash,
  Shield,
  User as UserIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  
  // Fetch users
  const { data: users, isLoading } = useQuery<Omit<User, "password">[]>({
    queryKey: ["/api/users"],
  });
  
  // Create user schema
  const createUserSchema = insertUserSchema.extend({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
  
  // Edit user schema (no password)
  const editUserSchema = insertUserSchema.pick({
    name: true,
    role: true,
  });
  
  // Create user form
  const createUserForm = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      name: "",
      role: UserRole.VIEWER,
    },
  });
  
  // Edit user form
  const editUserForm = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: "",
      role: UserRole.VIEWER,
    },
  });
  
  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createUserSchema>) => {
      const { confirmPassword, ...userData } = data;
      const response = await apiRequest("POST", "/api/users", userData);
      return response.json();
    },
    onSuccess: () => {
      setIsCreateUserOpen(false);
      createUserForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User created",
        description: "The user has been created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async (data: { id: number; userData: z.infer<typeof editUserSchema> }) => {
      const response = await apiRequest("PUT", `/api/users/${data.id}`, data.userData);
      return response.json();
    },
    onSuccess: () => {
      setIsEditUserOpen(false);
      setUserToEdit(null);
      editUserForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User updated",
        description: "The user has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User deleted",
        description: "The user has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle user creation
  const onCreateUserSubmit = (data: z.infer<typeof createUserSchema>) => {
    createUserMutation.mutate(data);
  };
  
  // Handle user edit
  const onEditUserSubmit = (data: z.infer<typeof editUserSchema>) => {
    if (!userToEdit) return;
    editUserMutation.mutate({ id: userToEdit.id, userData: data });
  };
  
  // Handle user deletion
  const handleDeleteUser = (userId: number) => {
    // Don't delete current user
    if (userId === user?.id) {
      toast({
        title: "Cannot delete yourself",
        description: "You cannot delete your own account",
        variant: "destructive",
      });
      return;
    }
    
    if (window.confirm("Are you sure you want to delete this user?")) {
      deleteUserMutation.mutate(userId);
    }
  };
  
  // Open edit user dialog
  const handleEditUser = (user: User) => {
    setUserToEdit(user);
    editUserForm.reset({
      name: user.name,
      role: user.role as any,
    });
    setIsEditUserOpen(true);
  };
  
  // Get role badge color
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case UserRole.ADMIN:
        return "bg-red-100 text-red-800";
      case UserRole.EDITOR:
        return "bg-blue-100 text-blue-800";
      case UserRole.VIEWER:
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  return (
    <DashboardLayout>
      <div className="p-6 flex-1">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">User Management</h1>
            <p className="text-sm text-neutral-500 mt-1">Manage users and their access permissions</p>
          </div>
          
          <Button onClick={() => setIsCreateUserOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add New User
          </Button>
        </div>
        
        {/* Users Table */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : users && users.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center mr-3">
                            <UserIcon className="h-5 w-5 text-neutral-500" />
                          </div>
                          <span>{user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.id === user.id} // Prevent deleting self
                          >
                            <Trash className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="bg-neutral-100 p-3 rounded-full mb-4">
                <Users className="h-8 w-8 text-neutral-500" />
              </div>
              <h3 className="text-lg font-medium text-neutral-900 mb-2">No users found</h3>
              <p className="text-neutral-500 text-center mb-4">
                Add users to start managing access control
              </p>
              <Button onClick={() => setIsCreateUserOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Create User Dialog */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <Form {...createUserForm}>
            <form onSubmit={createUserForm.handleSubmit(onCreateUserSubmit)} className="space-y-4 py-2">
              <FormField
                control={createUserForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter user's full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createUserForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createUserForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createUserForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={UserRole.ADMIN}>Administrator</SelectItem>
                        <SelectItem value={UserRole.EDITOR}>Editor</SelectItem>
                        <SelectItem value={UserRole.VIEWER}>Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsCreateUserOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <Form {...editUserForm}>
            <form onSubmit={editUserForm.handleSubmit(onEditUserSubmit)} className="space-y-4 py-2">
              <FormField
                control={editUserForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter user's full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={UserRole.ADMIN}>Administrator</SelectItem>
                        <SelectItem value={UserRole.EDITOR}>Editor</SelectItem>
                        <SelectItem value={UserRole.VIEWER}>Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsEditUserOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={editUserMutation.isPending}
                >
                  {editUserMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update User"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
