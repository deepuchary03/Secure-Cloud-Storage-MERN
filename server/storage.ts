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
import { MongoClient, Db, ObjectId } from "mongodb";

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
  sessionStore: session.Store;
}

// MongoDB Document Mappings
const toUser = (doc: any): User => {
  if (!doc) return undefined as any;
  return {
    id: parseInt(doc._id),
    username: doc.username,
    password: doc.password,
    name: doc.name,
    role: doc.role
  };
};

const toFile = (doc: any): File => {
  if (!doc) return undefined as any;
  return {
    id: parseInt(doc._id),
    name: doc.name,
    path: doc.path,
    type: doc.type,
    size: doc.size,
    ownerId: parseInt(doc.ownerId),
    isFolder: doc.isFolder,
    parentId: doc.parentId !== null ? parseInt(doc.parentId) : null,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt)
  };
};

const toFilePermission = (doc: any): FilePermission => {
  if (!doc) return undefined as any;
  return {
    id: parseInt(doc._id),
    fileId: parseInt(doc.fileId),
    userId: parseInt(doc.userId),
    canRead: doc.canRead,
    canWrite: doc.canWrite,
    canDelete: doc.canDelete,
    canShare: doc.canShare
  };
};

const toActivityLog = (doc: any): ActivityLog => {
  if (!doc) return undefined as any;
  return {
    id: parseInt(doc._id),
    action: doc.action,
    details: doc.details,
    userId: parseInt(doc.userId),
    timestamp: new Date(doc.timestamp)
  };
};

export class MongoDBStorage implements IStorage {
  private client: MongoClient;
  private db: Db | null = null;
  public sessionStore: session.Store;
  private connected: boolean = false;

  constructor() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/securecloud';
    this.client = new MongoClient(uri, {
      // Add SSL connection options
      ssl: true,
      tlsAllowInvalidCertificates: true, // For development only
      tlsAllowInvalidHostnames: true, // For development only
      retryWrites: true
    });
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    this.initConnection();
  }

  private async initConnection() {
    try {
      await this.client.connect();
      this.db = this.client.db();
      
      // Create indexes
      if (this.db) {
        await this.db.collection('users').createIndex({ username: 1 }, { unique: true });
        await this.db.collection('files').createIndex({ parentId: 1 });
        await this.db.collection('files').createIndex({ ownerId: 1 });
        await this.db.collection('file_permissions').createIndex({ fileId: 1 });
        await this.db.collection('file_permissions').createIndex({ userId: 1 });
      }
      
      this.connected = true;
      console.log('Connected to MongoDB');
      
      // Setup root folders for existing users
      this.createRootDirectoriesForUsers();
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      // Fallback to memory storage if MongoDB connection fails
    }
  }

  private async createRootDirectoriesForUsers(): Promise<void> {
    if (!this.db || !this.connected) return;
    
    try {
      const users = await this.db.collection('users').find().toArray();
      
      for (const user of users) {
        const rootDirectory = await this.db.collection('files').findOne({
          ownerId: user._id.toString(),
          isFolder: true,
          parentId: null,
          name: 'Root'
        });
        
        if (!rootDirectory) {
          await this.db.collection('files').insertOne({
            _id: this.generateId().toString(),
            name: "Root",
            path: '/',
            type: "folder",
            size: 0,
            ownerId: user._id.toString(),
            isFolder: true,
            parentId: null,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error creating root directories:', error);
    }
  }

  private generateId(): number {
    return Math.floor(Math.random() * 1000000) + 1;
  }

  // User Management
  async getUser(id: number): Promise<User | undefined> {
    if (!this.db || !this.connected) return undefined;
    
    try {
      const user = await this.db.collection('users').findOne({ _id: id.toString() });
      return user ? toUser(user) : undefined;
    } catch (error) {
      console.error('Error fetching user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!this.db || !this.connected) return undefined;
    
    try {
      const user = await this.db.collection('users').findOne({ 
        username: { $regex: new RegExp('^' + username + '$', 'i') } 
      });
      return user ? toUser(user) : undefined;
    } catch (error) {
      console.error('Error fetching user by username:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!this.db || !this.connected) throw new Error('Database not connected');
    
    try {
      const id = this.generateId();
      const user = { _id: id.toString(), ...insertUser };
      
      await this.db.collection('users').insertOne(user);
      
      // Create root folder
      await this.createFile({
        name: "Root",
        path: "/",
        type: "folder",
        size: 0,
        ownerId: id,
        isFolder: true,
        parentId: null
      });
      
      return toUser(user);
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    if (!this.db || !this.connected) throw new Error('Database not connected');
    
    try {
      await this.db.collection('users').updateOne(
        { _id: id.toString() }, 
        { $set: data }
      );
      
      const updatedUser = await this.getUser(id);
      if (!updatedUser) {
        throw new Error(`User with id ${id} not found`);
      }
      
      return updatedUser;
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    if (!this.db || !this.connected) return false;
    
    try {
      // Delete user's files
      const userFiles = await this.getFilesByOwner(id);
      for (const file of userFiles) {
        await this.deleteFile(file.id);
      }
      
      // Delete user's permissions
      if (this.db) {
        const permissions = await this.db.collection('file_permissions')
          .find({ userId: id.toString() })
          .toArray();
          
        for (const perm of permissions) {
          await this.deleteFilePermission(parseInt(perm._id));
        }
      }
      
      // Delete user
      const result = await this.db.collection('users').deleteOne({ _id: id.toString() });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  async getAllUsers(): Promise<User[]> {
    if (!this.db || !this.connected) return [];
    
    try {
      const users = await this.db.collection('users').find().toArray();
      return users.map(toUser);
    } catch (error) {
      console.error('Error fetching all users:', error);
      return [];
    }
  }

  // File Management
  async getFile(id: number): Promise<File | undefined> {
    if (!this.db || !this.connected) return undefined;
    
    try {
      const file = await this.db.collection('files').findOne({ _id: id.toString() });
      return file ? toFile(file) : undefined;
    } catch (error) {
      console.error('Error fetching file:', error);
      return undefined;
    }
  }

  async getFilesByOwner(ownerId: number): Promise<File[]> {
    if (!this.db || !this.connected) return [];
    
    try {
      const files = await this.db.collection('files')
        .find({ ownerId: ownerId.toString() })
        .toArray();
      return files.map(toFile);
    } catch (error) {
      console.error('Error fetching files by owner:', error);
      return [];
    }
  }

  async getFilesByParent(parentId: number | null): Promise<File[]> {
    if (!this.db || !this.connected) return [];
    
    try {
      const query = parentId === null 
        ? { parentId: null } 
        : { parentId: parentId.toString() };
      
      const files = await this.db.collection('files')
        .find(query)
        .toArray();
      return files.map(toFile);
    } catch (error) {
      console.error('Error fetching files by parent:', error);
      return [];
    }
  }

  async getSharedFiles(userId: number): Promise<File[]> {
    if (!this.db || !this.connected) return [];
    
    try {
      // Get all file IDs where the user has permissions
      const permissions = await this.db.collection('file_permissions')
        .find({ userId: userId.toString() })
        .toArray();
      
      const fileIds = permissions.map(p => p.fileId);
      
      if (fileIds.length === 0) return [];
      
      // Get the files with those IDs that the user doesn't own
      const files = await this.db.collection('files')
        .find({ 
          _id: { $in: fileIds },
          ownerId: { $ne: userId.toString() }
        })
        .toArray();
      
      return files.map(toFile);
    } catch (error) {
      console.error('Error fetching shared files:', error);
      return [];
    }
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    if (!this.db || !this.connected) throw new Error('Database not connected');
    
    try {
      const now = new Date();
      const id = this.generateId();
      
      const file = {
        _id: id.toString(),
        ...insertFile,
        ownerId: insertFile.ownerId.toString(),
        parentId: insertFile.parentId ? insertFile.parentId.toString() : null,
        createdAt: now,
        updatedAt: now
      };
      
      await this.db.collection('files').insertOne(file);
      
      return {
        ...insertFile,
        id,
        createdAt: now,
        updatedAt: now
      };
    } catch (error) {
      console.error('Error creating file:', error);
      throw new Error('Failed to create file');
    }
  }

  async updateFile(id: number, data: Partial<File>): Promise<File> {
    if (!this.db || !this.connected) throw new Error('Database not connected');
    
    try {
      const updateData = { ...data, updatedAt: new Date() };
      
      if (data.parentId !== undefined) {
        updateData.parentId = data.parentId ? data.parentId.toString() : null;
      }
      
      if (data.ownerId !== undefined) {
        updateData.ownerId = data.ownerId.toString();
      }
      
      await this.db.collection('files').updateOne(
        { _id: id.toString() },
        { $set: updateData }
      );
      
      const updatedFile = await this.getFile(id);
      if (!updatedFile) {
        throw new Error(`File with id ${id} not found`);
      }
      
      return updatedFile;
    } catch (error) {
      console.error('Error updating file:', error);
      throw new Error('Failed to update file');
    }
  }

  async deleteFile(id: number): Promise<boolean> {
    if (!this.db || !this.connected) return false;
    
    try {
      const file = await this.getFile(id);
      if (!file) return false;
      
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
      await this.db.collection('file_permissions').deleteMany({ fileId: id.toString() });
      
      // Delete the file entry
      const result = await this.db.collection('files').deleteOne({ _id: id.toString() });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  // File Permissions
  async getFilePermissions(fileId: number): Promise<FilePermission[]> {
    if (!this.db || !this.connected) return [];
    
    try {
      const permissions = await this.db.collection('file_permissions')
        .find({ fileId: fileId.toString() })
        .toArray();
      return permissions.map(toFilePermission);
    } catch (error) {
      console.error('Error fetching file permissions:', error);
      return [];
    }
  }

  async getUserFilePermission(fileId: number, userId: number): Promise<FilePermission | undefined> {
    if (!this.db || !this.connected) return undefined;
    
    try {
      const permission = await this.db.collection('file_permissions').findOne({
        fileId: fileId.toString(),
        userId: userId.toString()
      });
      return permission ? toFilePermission(permission) : undefined;
    } catch (error) {
      console.error('Error fetching user file permission:', error);
      return undefined;
    }
  }

  async createFilePermission(permission: InsertFilePermission): Promise<FilePermission> {
    if (!this.db || !this.connected) throw new Error('Database not connected');
    
    try {
      const id = this.generateId();
      
      const filePermission = {
        _id: id.toString(),
        ...permission,
        fileId: permission.fileId.toString(),
        userId: permission.userId.toString()
      };
      
      await this.db.collection('file_permissions').insertOne(filePermission);
      
      return {
        ...permission,
        id
      };
    } catch (error) {
      console.error('Error creating file permission:', error);
      throw new Error('Failed to create file permission');
    }
  }

  async updateFilePermission(id: number, data: Partial<FilePermission>): Promise<FilePermission> {
    if (!this.db || !this.connected) throw new Error('Database not connected');
    
    try {
      const updateData = { ...data };
      
      if (data.fileId !== undefined) {
        updateData.fileId = data.fileId.toString();
      }
      
      if (data.userId !== undefined) {
        updateData.userId = data.userId.toString();
      }
      
      await this.db.collection('file_permissions').updateOne(
        { _id: id.toString() },
        { $set: updateData }
      );
      
      const permission = await this.db.collection('file_permissions').findOne({ _id: id.toString() });
      
      if (!permission) {
        throw new Error(`Permission with id ${id} not found`);
      }
      
      return toFilePermission(permission);
    } catch (error) {
      console.error('Error updating file permission:', error);
      throw new Error('Failed to update file permission');
    }
  }

  async deleteFilePermission(id: number): Promise<boolean> {
    if (!this.db || !this.connected) return false;
    
    try {
      const result = await this.db.collection('file_permissions').deleteOne({ _id: id.toString() });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting file permission:', error);
      return false;
    }
  }

  // Activity Logs
  async logActivity(log: InsertActivityLog): Promise<ActivityLog> {
    if (!this.db || !this.connected) throw new Error('Database not connected');
    
    try {
      const id = this.generateId();
      const timestamp = new Date();
      
      const activityLog = {
        _id: id.toString(),
        ...log,
        userId: log.userId.toString(),
        timestamp
      };
      
      await this.db.collection('activity_logs').insertOne(activityLog);
      
      return {
        ...log,
        id,
        timestamp
      };
    } catch (error) {
      console.error('Error logging activity:', error);
      throw new Error('Failed to log activity');
    }
  }

  async getActivityLogs(): Promise<ActivityLog[]> {
    if (!this.db || !this.connected) return [];
    
    try {
      const logs = await this.db.collection('activity_logs')
        .find()
        .sort({ timestamp: -1 })
        .toArray();
      return logs.map(toActivityLog);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      return [];
    }
  }

  async getUserActivityLogs(userId: number): Promise<ActivityLog[]> {
    if (!this.db || !this.connected) return [];
    
    try {
      const logs = await this.db.collection('activity_logs')
        .find({ userId: userId.toString() })
        .sort({ timestamp: -1 })
        .toArray();
      return logs.map(toActivityLog);
    } catch (error) {
      console.error('Error fetching user activity logs:', error);
      return [];
    }
  }
}

// Memory Storage Implementation as Fallback
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private files: Map<number, File>;
  private filePermissions: Map<number, FilePermission>;
  private activityLogs: Map<number, ActivityLog>;
  private userIdCounter: number;
  private fileIdCounter: number;
  private filePermissionIdCounter: number;
  private activityLogIdCounter: number;
  public sessionStore: session.Store;

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

// Decide which storage to use based on environment
// Temporarily using memory storage until MongoDB connection issues are resolved
export const storage = new MemStorage();
