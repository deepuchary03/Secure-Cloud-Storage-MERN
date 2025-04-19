import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import MyFiles from "@/pages/my-files";
import SharedFiles from "@/pages/shared-files";
import UserManagement from "@/pages/user-management";
import AccessControl from "@/pages/access-control";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/my-files" component={MyFiles} />
      <ProtectedRoute path="/my-files/:folderId" component={MyFiles} />
      <ProtectedRoute path="/shared" component={SharedFiles} />
      <ProtectedRoute path="/users" component={UserManagement} />
      <ProtectedRoute path="/access-control" component={AccessControl} />
      
      {/* Redirect Recent and Cloud Storage to My Files for now */}
      <ProtectedRoute path="/recent" component={MyFiles} />
      <ProtectedRoute path="/cloud" component={MyFiles} />
      
      {/* Redirect Activity Logs to Dashboard for now */}
      <ProtectedRoute path="/logs" component={Dashboard} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
