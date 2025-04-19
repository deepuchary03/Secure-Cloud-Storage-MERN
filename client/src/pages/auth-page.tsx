import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileArchive, Lock, Database, Shield } from "lucide-react";

// Extend the schema with validation rules
const loginSchema = insertUserSchema.pick({
  username: true,
  password: true,
}).extend({
  username: z.string().min(2, "Username must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = insertUserSchema.pick({
  username: true,
  password: true,
  name: true,
}).extend({
  username: z.string().min(2, "Username must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const { user, loginMutation, registerMutation } = useAuth();
  const [_, navigate] = useLocation();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    // Redirect if already logged in
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  async function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate(values);
  }

  async function onRegisterSubmit(values: z.infer<typeof registerSchema>) {
    const { confirmPassword, ...userData } = values;
    registerMutation.mutate(userData);
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-neutral-50">
      {/* Hero Section */}
      <div className="bg-primary-600 text-white p-8 md:w-1/2 flex flex-col justify-center">
        <div className="max-w-md mx-auto">
          <div className="flex items-center mb-8">
            <Database className="h-12 w-12 mr-4" />
            <h1 className="text-3xl font-bold">SecureCloud</h1>
          </div>
          
          <h2 className="text-2xl md:text-4xl font-bold mb-6">Secure Cloud Storage with Role-Based Access Control</h2>
          <p className="text-lg mb-8 text-primary-100">
            Store, share, and manage your files securely with enterprise-grade access controls and permissions.
          </p>
          
          <div className="space-y-6">
            <div className="flex items-start">
              <div className="bg-primary-500 p-2 rounded-full mr-4">
                <FileArchive className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Secure File Storage</h3>
                <p className="text-primary-100">Upload and manage files with confidence</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-primary-500 p-2 rounded-full mr-4">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Advanced Permissions</h3>
                <p className="text-primary-100">Control who can view, edit and share your files</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-primary-500 p-2 rounded-full mr-4">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Role-Based Access</h3>
                <p className="text-primary-100">Define user roles for granular access control</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Auth Forms */}
      <div className="p-8 md:w-1/2 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">
              {activeTab === "login" ? "Welcome back" : "Create an account"}
            </CardTitle>
            <CardDescription>
              {activeTab === "login" 
                ? "Enter your credentials to access your account" 
                : "Fill in the information to create your account"}
            </CardDescription>
          </CardHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
                  <CardContent className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter your password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "Logging in..." : "Login"}
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </TabsContent>
            
            <TabsContent value="register">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)}>
                  <CardContent className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Choose a username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Choose a password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Confirm your password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "Creating account..." : "Create Account"}
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
