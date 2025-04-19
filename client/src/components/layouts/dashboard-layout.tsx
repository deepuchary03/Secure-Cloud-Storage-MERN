import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Database,
  Folder,
  Share2,
  Clock,
  Cloud,
  Users,
  Shield,
  BarChart2,
  Menu,
  X,
  LogOut,
  Settings,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on location change or resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [location]);

  // Navigation items with access control
  const navItems = [
    {
      label: "Dashboard",
      icon: <BarChart2 className="w-5 h-5 mr-3" />,
      href: "/",
      roles: ["admin", "editor", "viewer"]
    },
    {
      label: "My Files",
      icon: <Folder className="w-5 h-5 mr-3" />,
      href: "/my-files",
      roles: ["admin", "editor", "viewer"]
    },
    {
      label: "Shared with me",
      icon: <Share2 className="w-5 h-5 mr-3" />,
      href: "/shared",
      roles: ["admin", "editor", "viewer"]
    },
    {
      label: "Recent",
      icon: <Clock className="w-5 h-5 mr-3" />,
      href: "/recent",
      roles: ["admin", "editor", "viewer"]
    },
    {
      label: "Cloud Storage",
      icon: <Cloud className="w-5 h-5 mr-3" />,
      href: "/cloud",
      roles: ["admin", "editor", "viewer"]
    },
    {
      // Admin section header - not a link
      label: "Admin",
      isHeader: true,
      href: "",
      roles: ["admin"]
    },
    {
      label: "User Management",
      icon: <Users className="w-5 h-5 mr-3" />,
      href: "/users",
      roles: ["admin"]
    },
    {
      label: "Access Control",
      icon: <Shield className="w-5 h-5 mr-3" />,
      href: "/access-control",
      roles: ["admin"]
    },
    {
      label: "Activity Logs",
      icon: <BarChart2 className="w-5 h-5 mr-3" />,
      href: "/logs",
      roles: ["admin"]
    }
  ];

  // Filter navigation items based on user role
  const filteredNavItems = navItems.filter(item => {
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  // Handle user logout
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return "";
    return user.name
      .split(" ")
      .map(name => name[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "sidebar-transition bg-white border-r border-neutral-200 w-64 h-full flex flex-col shadow-sm z-20",
          isMobileMenuOpen ? "fixed inset-y-0 left-0" : "hidden md:flex"
        )}
      >
        <div className="p-4 border-b border-neutral-100 flex items-center">
          <div className="flex items-center flex-1">
            <Database className="h-8 w-8 text-primary-600" />
            <h1 className="ml-2 text-lg font-semibold text-neutral-900">SecureCloud</h1>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="icon-btn md:hidden"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {filteredNavItems.map((item, index) => {
            // Handle section headers
            if (item.isHeader) {
              return (
                <div key={index} className="pt-4 mt-4 border-t border-neutral-200">
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    {item.label}
                  </div>
                </div>
              );
            }
            
            // Regular navigation item
            return (
              <Link 
                key={index} 
                href={item.href || "/"}
                className={cn(
                  "flex items-center px-3 py-2 rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors",
                  location === item.href && "bg-primary-50 text-primary-700 font-medium"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-200">
          <div className="flex items-center">
            <Avatar className="h-8 w-8 rounded-full border border-neutral-200">
              <AvatarFallback className="bg-primary-100 text-primary-700">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-neutral-800">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-neutral-500 capitalize">
                {user?.role || 'Loading...'}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="h-4 w-4 text-neutral-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-neutral-50 flex flex-col">
        {/* Top Navigation Bar */}
        <header className="bg-white border-b border-neutral-200 shadow-sm py-3 px-6 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="mr-4 md:hidden icon-btn"
              >
                <Menu className="w-5 h-5 text-neutral-500" />
              </button>
              <h2 className="text-lg font-medium text-neutral-900">
                {/* Show page title based on current location */}
                {location === "/" && "Dashboard"}
                {location === "/my-files" && "My Files"}
                {location.includes("/my-files/") && "Folder"}
                {location === "/shared" && "Shared with me"}
                {location === "/users" && "User Management"}
                {location === "/access-control" && "Access Control"}
                {location === "/cloud" && "Cloud Storage"}
                {location === "/recent" && "Recent Files"}
                {location === "/logs" && "Activity Logs"}
              </h2>
            </div>

            <div className="flex items-center space-x-4">
              <form className="hidden sm:block relative">
                <input
                  type="text"
                  placeholder="Search files..."
                  className="pl-9 pr-4 py-2 rounded-md text-sm border border-neutral-300 bg-neutral-50 w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
              </form>

              <Button variant="ghost" size="icon" className="relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="w-5 h-5 text-neutral-500"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
                <span className="absolute top-0 right-0 bg-red-500 w-2 h-2 rounded-full"></span>
              </Button>

              <Button variant="ghost" size="icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="w-5 h-5 text-neutral-500"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                  />
                </svg>
              </Button>
            </div>
          </div>
        </header>

        {/* Main content */}
        {children}
      </main>
    </div>
  );
}
