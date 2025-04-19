import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { isAuthenticated, isAdmin, hasRole, upload } from "./middlewares";
import { UserRole } from "@shared/schema";
import fs from "fs";
import path from "path";
import { UPLOAD_DIR } from "./middlewares";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  await setupAuth(app);

  // User Management Routes (Admin only)
  app.get("/api/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const sanitizedUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(sanitizedUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser(req.body);
      const { password, ...userWithoutPassword } = user;
      
      // Log activity
      await storage.logActivity({
        userId: req.user.id,
        action: "CREATE_USER",
        details: `Admin created user ${user.username}`
      });

      res.status(201).json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUser(userId, req.body);
      const { password, ...userWithoutPassword } = updatedUser;
      
      // Log activity
      await storage.logActivity({
        userId: req.user.id,
        action: "UPDATE_USER",
        details: `Admin updated user ${updatedUser.username}`
      });

      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Prevent deleting self
      if (userId === req.user.id) {
        return res.status(400).json({ message: "Cannot delete yourself" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const deleted = await storage.deleteUser(userId);
      
      if (deleted) {
        // Log activity
        await storage.logActivity({
          userId: req.user.id,
          action: "DELETE_USER",
          details: `Admin deleted user ${user.username}`
        });
        
        res.status(200).json({ message: "User deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete user" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // File Management Routes
  app.get("/api/files", isAuthenticated, async (req, res) => {
    try {
      const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : null;
      const files = await storage.getFilesByParent(parentId);
      
      // Filter files based on permissions
      const isAdmin = req.user.role === UserRole.ADMIN;
      const filteredFiles = files.filter(file => {
        // User is owner or admin
        if (file.ownerId === req.user.id || isAdmin) {
          return true;
        }
        
        // Check permissions
        const permission = storage.getUserFilePermission(file.id, req.user.id);
        return !!permission;
      });
      
      res.json(filteredFiles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  app.get("/api/files/shared", isAuthenticated, async (req, res) => {
    try {
      const files = await storage.getSharedFiles(req.user.id);
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shared files" });
    }
  });

  app.get("/api/files/:id", isAuthenticated, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Check if user has access to the file
      const isOwner = file.ownerId === req.user.id;
      const isAdmin = req.user.role === UserRole.ADMIN;
      
      if (!isOwner && !isAdmin) {
        const permission = await storage.getUserFilePermission(fileId, req.user.id);
        if (!permission) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      res.json(file);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch file" });
    }
  });

  app.post("/api/files/folder", isAuthenticated, async (req, res) => {
    try {
      const { name, parentId } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Folder name is required" });
      }
      
      // Create a new folder
      const folder = await storage.createFile({
        name,
        path: `/`,
        type: "folder",
        size: 0,
        ownerId: req.user.id,
        parentId: parentId || null,
        isFolder: true
      });
      
      // Log activity
      await storage.logActivity({
        userId: req.user.id,
        action: "CREATE_FOLDER",
        details: `Created folder: ${name}`
      });
      
      res.status(201).json(folder);
    } catch (error) {
      res.status(500).json({ message: "Failed to create folder" });
    }
  });

  app.post("/api/files/upload", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const { originalname, mimetype, size, filename, path: filePath } = req.file;
      const parentId = req.body.parentId ? parseInt(req.body.parentId) : null;
      
      // Create file record
      const relativePath = filePath.replace(UPLOAD_DIR, '');
      const file = await storage.createFile({
        name: originalname,
        path: relativePath,
        type: mimetype,
        size,
        ownerId: req.user.id,
        parentId,
        isFolder: false
      });
      
      // Log activity
      await storage.logActivity({
        userId: req.user.id,
        action: "UPLOAD_FILE",
        details: `Uploaded file: ${originalname}`
      });
      
      res.status(201).json(file);
    } catch (error) {
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.get("/api/files/:id/download", isAuthenticated, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      if (file.isFolder) {
        return res.status(400).json({ message: "Cannot download a folder" });
      }
      
      // Check if user has access to the file
      const isOwner = file.ownerId === req.user.id;
      const isAdmin = req.user.role === UserRole.ADMIN;
      
      if (!isOwner && !isAdmin) {
        const permission = await storage.getUserFilePermission(fileId, req.user.id);
        if (!permission || !permission.canRead) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const filePath = path.join(UPLOAD_DIR, file.path);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }
      
      // Log activity
      await storage.logActivity({
        userId: req.user.id,
        action: "DOWNLOAD_FILE",
        details: `Downloaded file: ${file.name}`
      });
      
      res.download(filePath, file.name);
    } catch (error) {
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  app.delete("/api/files/:id", isAuthenticated, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Check if user has permission to delete
      const isOwner = file.ownerId === req.user.id;
      const isAdmin = req.user.role === UserRole.ADMIN;
      
      if (!isOwner && !isAdmin) {
        const permission = await storage.getUserFilePermission(fileId, req.user.id);
        if (!permission || !permission.canDelete) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const deleted = await storage.deleteFile(fileId);
      
      if (deleted) {
        // Log activity
        await storage.logActivity({
          userId: req.user.id,
          action: "DELETE_FILE",
          details: `Deleted ${file.isFolder ? 'folder' : 'file'}: ${file.name}`
        });
        
        res.json({ message: "File deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete file" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // File Sharing & Permissions
  app.get("/api/files/:id/permissions", isAuthenticated, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Check if user has permission to view permissions
      const isOwner = file.ownerId === req.user.id;
      const isAdmin = req.user.role === UserRole.ADMIN;
      
      if (!isOwner && !isAdmin) {
        const permission = await storage.getUserFilePermission(fileId, req.user.id);
        if (!permission || !permission.canShare) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const permissions = await storage.getFilePermissions(fileId);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  app.post("/api/files/:id/share", isAuthenticated, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const { userId, canRead, canWrite, canDelete, canShare } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Check if user has permission to share
      const isOwner = file.ownerId === req.user.id;
      const isAdmin = req.user.role === UserRole.ADMIN;
      
      if (!isOwner && !isAdmin) {
        const permission = await storage.getUserFilePermission(fileId, req.user.id);
        if (!permission || !permission.canShare) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      // Check if user being shared with exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }
      
      // Check if permission already exists
      const existingPermission = await storage.getUserFilePermission(fileId, userId);
      
      let permission;
      if (existingPermission) {
        // Update existing permission
        permission = await storage.updateFilePermission(existingPermission.id, {
          canRead: canRead ?? existingPermission.canRead,
          canWrite: canWrite ?? existingPermission.canWrite,
          canDelete: canDelete ?? existingPermission.canDelete,
          canShare: canShare ?? existingPermission.canShare
        });
      } else {
        // Create new permission
        permission = await storage.createFilePermission({
          fileId,
          userId,
          canRead: canRead ?? true,
          canWrite: canWrite ?? false,
          canDelete: canDelete ?? false,
          canShare: canShare ?? false
        });
      }
      
      // Log activity
      await storage.logActivity({
        userId: req.user.id,
        action: "SHARE_FILE",
        details: `Shared ${file.name} with user ${targetUser.username}`
      });
      
      res.status(201).json(permission);
    } catch (error) {
      res.status(500).json({ message: "Failed to share file" });
    }
  });

  app.delete("/api/files/:fileId/share/:userId", isAuthenticated, async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const userId = parseInt(req.params.userId);
      
      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Check if user has permission to manage sharing
      const isOwner = file.ownerId === req.user.id;
      const isAdmin = req.user.role === UserRole.ADMIN;
      
      if (!isOwner && !isAdmin) {
        const permission = await storage.getUserFilePermission(fileId, req.user.id);
        if (!permission || !permission.canShare) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      // Find the permission
      const permission = await storage.getUserFilePermission(fileId, userId);
      if (!permission) {
        return res.status(404).json({ message: "Permission not found" });
      }
      
      const deleted = await storage.deleteFilePermission(permission.id);
      
      if (deleted) {
        // Log activity
        const targetUser = await storage.getUser(userId);
        await storage.logActivity({
          userId: req.user.id,
          action: "REVOKE_SHARE",
          details: `Revoked access to ${file.name} for user ${targetUser?.username || userId}`
        });
        
        res.json({ message: "Permission removed successfully" });
      } else {
        res.status(500).json({ message: "Failed to remove permission" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to remove permission" });
    }
  });

  // Activity Logs
  app.get("/api/logs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const logs = await storage.getActivityLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  app.get("/api/logs/user", isAuthenticated, async (req, res) => {
    try {
      const logs = await storage.getUserActivityLogs(req.user.id);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user activity logs" });
    }
  });

  // Stats
  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      const userFiles = await storage.getFilesByOwner(req.user.id);
      const sharedFiles = await storage.getSharedFiles(req.user.id);
      
      // Calculate total storage used
      const storageUsed = userFiles.reduce((total, file) => total + file.size, 0);
      
      // Count folders
      const folderCount = userFiles.filter(file => file.isFolder).length;
      
      // Count files
      const fileCount = userFiles.filter(file => !file.isFolder).length;
      
      // Get recent activity
      const userActivity = await storage.getUserActivityLogs(req.user.id);
      const recentActivity = userActivity.slice(0, 10);
      
      res.json({
        storageUsed,
        fileCount,
        folderCount,
        sharedFilesCount: sharedFiles.length,
        recentActivity
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
