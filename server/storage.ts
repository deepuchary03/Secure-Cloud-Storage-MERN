import {
  User,
  InsertUser,
  File,
  InsertFile,
  FilePermission,
  InsertFilePermission,
  ActivityLog,
  InsertActivityLog,
  UserRole
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import fs from "fs";
import path from "path";
import { UPLOAD_DIR } from "./middlewares";

// Create memory store for sessions
const MemoryStore = createMemoryStore(session);

// Define the storage interface
export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  
  // File management
  getFile(id: number): Promise<File | undefined>;
  getFilesByOwner(ownerId: number): Promise<File[]>;
  getFilesByParent(parentId: number | null): Promise<File[]>;
  getSharedFiles(userId: number): Promise<File[]>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(id: number, data: Partial<File>): Promise<File>;
  deleteFile(id: number): Promise<boolean>;
  
  // File permissions
  getFilePermissions(fileId: number): Promise<FilePermission[]>;
  getUserFilePermission(fileId: number, userId: number): Promise<FilePermission | undefined>;
  createFilePermission(permission: InsertFilePermission): Promise<FilePermission>;
  updateFilePermission(id: number, data: Partial<FilePermission>): Promise<FilePermission>;
  deleteFilePermission(id: number): Promise<boolean>;
  
  // Activity logs
  logActivity(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(): Promise<ActivityLog[]>;
  getUserActivityLogs(userId: number): Promise<ActivityLog[]>;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private files: Map<number, File>;
  private filePermissions: Map<number, FilePermission>;
  private activityLogs: Map<number, ActivityLog>;
  private userIdCounter: number;
  private fileIdCounter: number;
  private filePermissionIdCounter: number;
  private activityLogIdCounter: number;
  public sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.files = new Map();
    this.filePermissions = new Map();
    this.activityLogs = new Map();
    this.userIdCounter = 1;
    this.fileIdCounter = 1;
    this.filePermissionIdCounter = 1;
    this.activityLogIdCounter = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    // Create the root directory for each pre-defined user
    this.createRootDirectoriesForUsers();
  }

  // Helper to create initial root directories for each user
  private async createRootDirectoriesForUsers(): Promise<void> {
    // This will be called when users are created
  }
  
  // User Management
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    
    // Create root folder for the user
    await this.createFile({
      name: "Root",
      path: `/`,
      type: "folder",
      size: 0,
      ownerId: id,
      isFolder: true,
      parentId: null
    });
    
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }

    const updatedUser: User = { ...user, ...data };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const user = await this.getUser(id);
    if (!user) {
      return false;
    }

    // Delete user's files
    const userFiles = await this.getFilesByOwner(id);
    for (const file of userFiles) {
      await this.deleteFile(file.id);
    }

    // Delete user's permissions
    const userPermissions = Array.from(this.filePermissions.values())
      .filter(perm => perm.userId === id);
    for (const perm of userPermissions) {
      await this.deleteFilePermission(perm.id);
    }

    // Delete user
    return this.users.delete(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // File Management
  async getFile(id: number): Promise<File | undefined> {
    return this.files.get(id);
  }

  async getFilesByOwner(ownerId: number): Promise<File[]> {
    return Array.from(this.files.values())
      .filter(file => file.ownerId === ownerId);
  }

  async getFilesByParent(parentId: number | null): Promise<File[]> {
    return Array.from(this.files.values())
      .filter(file => file.parentId === parentId);
  }

  async getSharedFiles(userId: number): Promise<File[]> {
    // Get all file IDs where the user has permissions
    const permissionFileIds = Array.from(this.filePermissions.values())
      .filter(perm => perm.userId === userId)
      .map(perm => perm.fileId);
    
    // Get the files with those IDs that the user doesn't own
    return Array.from(this.files.values())
      .filter(file => permissionFileIds.includes(file.id) && file.ownerId !== userId);
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const id = this.fileIdCounter++;
    const now = new Date();
    const file: File = { 
      ...insertFile, 
      id,
      createdAt: now,
      updatedAt: now
    };
    this.files.set(id, file);
    return file;
  }

  async updateFile(id: number, data: Partial<File>): Promise<File> {
    const file = await this.getFile(id);
    if (!file) {
      throw new Error(`File with id ${id} not found`);
    }

    const updatedFile: File = { 
      ...file, 
      ...data,
      updatedAt: new Date()
    };
    this.files.set(id, updatedFile);
    return updatedFile;
  }

  async deleteFile(id: number): Promise<boolean> {
    const file = await this.getFile(id);
    if (!file) {
      return false;
    }

    // If it's a folder, recursively delete all children
    if (file.isFolder) {
      const children = await this.getFilesByParent(id);
      for (const child of children) {
        await this.deleteFile(child.id);
      }
    } else {
      // Delete the actual file if it exists on disk
      try {
        if (file.path) {
          const filePath = path.join(UPLOAD_DIR, file.path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      } catch (error) {
        console.error(`Error deleting file ${file.name}:`, error);
      }
    }

    // Delete all permissions for this file
    const filePermissions = Array.from(this.filePermissions.values())
      .filter(perm => perm.fileId === id);
    for (const perm of filePermissions) {
      await this.deleteFilePermission(perm.id);
    }

    // Delete the file entry
    return this.files.delete(id);
  }

  // File Permissions
  async getFilePermissions(fileId: number): Promise<FilePermission[]> {
    return Array.from(this.filePermissions.values())
      .filter(perm => perm.fileId === fileId);
  }

  async getUserFilePermission(fileId: number, userId: number): Promise<FilePermission | undefined> {
    return Array.from(this.filePermissions.values())
      .find(perm => perm.fileId === fileId && perm.userId === userId);
  }

  async createFilePermission(permission: InsertFilePermission): Promise<FilePermission> {
    const id = this.filePermissionIdCounter++;
    const filePermission: FilePermission = { ...permission, id };
    this.filePermissions.set(id, filePermission);
    return filePermission;
  }

  async updateFilePermission(id: number, data: Partial<FilePermission>): Promise<FilePermission> {
    const permission = Array.from(this.filePermissions.values())
      .find(perm => perm.id === id);
    
    if (!permission) {
      throw new Error(`Permission with id ${id} not found`);
    }

    const updatedPermission: FilePermission = { ...permission, ...data };
    this.filePermissions.set(id, updatedPermission);
    return updatedPermission;
  }

  async deleteFilePermission(id: number): Promise<boolean> {
    return this.filePermissions.delete(id);
  }

  // Activity Logs
  async logActivity(log: InsertActivityLog): Promise<ActivityLog> {
    const id = this.activityLogIdCounter++;
    const timestamp = new Date();
    const activityLog: ActivityLog = { ...log, id, timestamp };
    this.activityLogs.set(id, activityLog);
    return activityLog;
  }

  async getActivityLogs(): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getUserActivityLogs(userId: number): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .filter(log => log.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

export const storage = new MemStorage();
