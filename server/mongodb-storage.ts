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
import { MongoClient, Db, ObjectId } from "mongodb";
import createMemoryStore from "memorystore";
import fs from "fs";
import path from "path";
import { UPLOAD_DIR } from "./middlewares";
import { IStorage } from "./storage";

// Create memory store for sessions (we'll keep using this for simplicity)
const MemoryStore = createMemoryStore(session);

// Convert MongoDB document to our schema types
const toUser = (doc: any): User => {
  if (!doc) return null as any;
  return {
    id: doc._id.toString(),
    username: doc.username,
    password: doc.password,
    name: doc.name,
    role: doc.role
  };
};

const toFile = (doc: any): File => {
  if (!doc) return null as any;
  return {
    id: doc._id.toString(),
    name: doc.name,
    path: doc.path,
    type: doc.type,
    size: doc.size,
    ownerId: doc.ownerId,
    isFolder: doc.isFolder,
    parentId: doc.parentId,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt)
  };
};

const toFilePermission = (doc: any): FilePermission => {
  if (!doc) return null as any;
  return {
    id: doc._id.toString(),
    fileId: doc.fileId,
    userId: doc.userId,
    canRead: doc.canRead,
    canWrite: doc.canWrite,
    canShare: doc.canShare
  };
};

const toActivityLog = (doc: any): ActivityLog => {
  if (!doc) return null as any;
  return {
    id: doc._id.toString(),
    action: doc.action,
    details: doc.details,
    userId: doc.userId,
    fileId: doc.fileId,
    timestamp: new Date(doc.timestamp)
  };
};

export class MongoDBStorage implements IStorage {
  private client: MongoClient;
  private db: Db | null = null;
  public sessionStore: session.SessionStore;

  constructor() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/securecloud';
    this.client = new MongoClient(uri);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    this.connect();
  }

  private async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db();
      console.log('Connected to MongoDB');
      
      // Create indexes for better performance
      const usersCollection = this.db.collection('users');
      await usersCollection.createIndex({ username: 1 }, { unique: true });
      
      const filesCollection = this.db.collection('files');
      await filesCollection.createIndex({ parentId: 1 });
      await filesCollection.createIndex({ ownerId: 1 });
      
      const permissionsCollection = this.db.collection('file_permissions');
      await permissionsCollection.createIndex({ fileId: 1 });
      await permissionsCollection.createIndex({ userId: 1 });
      
      // Create root directories for existing users if they don't exist
      this.createRootDirectoriesForUsers();
    } catch (error) {
      console.error('Failed to connect to MongoDB', error);
    }
  }

  // Helper to create initial root directories for each user
  private async createRootDirectoriesForUsers(): Promise<void> {
    if (!this.db) return;
    
    try {
      const users = await this.db.collection('users').find().toArray();
      for (const user of users) {
        // Check if user already has a root directory
        const rootDir = await this.db.collection('files').findOne({
          ownerId: user._id.toString(),
          isFolder: true,
          parentId: null,
          name: 'Root'
        });
        
        if (!rootDir) {
          // Create root folder for the user
          await this.db.collection('files').insertOne({
            name: "Root",
            path: `/`,
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
  
  // User Management
  async getUser(id: number): Promise<User | undefined> {
    if (!this.db) return undefined;
    
    try {
      const user = await this.db.collection('users').findOne({ _id: id.toString() });
      return user ? toUser(user) : undefined;
    } catch (error) {
      console.error('Error fetching user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!this.db) return undefined;
    
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
    if (!this.db) throw new Error('Database not connected');
    
    try {
      const result = await this.db.collection('users').insertOne({
        _id: new ObjectId().toString(),
        ...insertUser
      });
      
      const userId = result.insertedId.toString();
      const user = await this.getUser(userId as any);
      
      // Create root folder for the user
      await this.createFile({
        name: "Root",
        path: `/`,
        type: "folder",
        size: 0,
        ownerId: userId,
        isFolder: true,
        parentId: null
      });
      
      return user as User;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    if (!this.db) throw new Error('Database not connected');
    
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
    if (!this.db) return false;
    
    try {
      // Delete user's files
      const userFiles = await this.getFilesByOwner(id);
      for (const file of userFiles) {
        await this.deleteFile(file.id as any);
      }
      
      // Delete user's permissions
      const userPermissions = await this.db.collection('file_permissions')
        .find({ userId: id.toString() })
        .toArray();
      
      for (const perm of userPermissions) {
        await this.deleteFilePermission(perm._id.toString() as any);
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
    if (!this.db) return [];
    
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
    if (!this.db) return undefined;
    
    try {
      const file = await this.db.collection('files').findOne({ _id: id.toString() });
      return file ? toFile(file) : undefined;
    } catch (error) {
      console.error('Error fetching file:', error);
      return undefined;
    }
  }

  async getFilesByOwner(ownerId: number): Promise<File[]> {
    if (!this.db) return [];
    
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
    if (!this.db) return [];
    
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
    if (!this.db) return [];
    
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
    if (!this.db) throw new Error('Database not connected');
    
    try {
      const now = new Date();
      const fileId = new ObjectId().toString();
      
      await this.db.collection('files').insertOne({
        _id: fileId,
        ...insertFile,
        createdAt: now,
        updatedAt: now
      });
      
      const file = await this.getFile(fileId as any);
      return file as File;
    } catch (error) {
      console.error('Error creating file:', error);
      throw new Error('Failed to create file');
    }
  }

  async updateFile(id: number, data: Partial<File>): Promise<File> {
    if (!this.db) throw new Error('Database not connected');
    
    try {
      await this.db.collection('files').updateOne(
        { _id: id.toString() },
        { 
          $set: {
            ...data,
            updatedAt: new Date()
          } 
        }
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
    if (!this.db) return false;
    
    try {
      const file = await this.getFile(id);
      if (!file) return false;
      
      // If it's a folder, recursively delete all children
      if (file.isFolder) {
        const children = await this.getFilesByParent(id as any);
        for (const child of children) {
          await this.deleteFile(child.id as any);
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
    if (!this.db) return [];
    
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
    if (!this.db) return undefined;
    
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
    if (!this.db) throw new Error('Database not connected');
    
    try {
      const permissionId = new ObjectId().toString();
      
      await this.db.collection('file_permissions').insertOne({
        _id: permissionId,
        ...permission
      });
      
      const createdPermission = await this.db.collection('file_permissions').findOne({
        _id: permissionId
      });
      
      return toFilePermission(createdPermission) as FilePermission;
    } catch (error) {
      console.error('Error creating file permission:', error);
      throw new Error('Failed to create file permission');
    }
  }

  async updateFilePermission(id: number, data: Partial<FilePermission>): Promise<FilePermission> {
    if (!this.db) throw new Error('Database not connected');
    
    try {
      await this.db.collection('file_permissions').updateOne(
        { _id: id.toString() },
        { $set: data }
      );
      
      const updatedPermission = await this.db.collection('file_permissions').findOne({
        _id: id.toString()
      });
      
      if (!updatedPermission) {
        throw new Error(`Permission with id ${id} not found`);
      }
      
      return toFilePermission(updatedPermission);
    } catch (error) {
      console.error('Error updating file permission:', error);
      throw new Error('Failed to update file permission');
    }
  }

  async deleteFilePermission(id: number): Promise<boolean> {
    if (!this.db) return false;
    
    try {
      const result = await this.db.collection('file_permissions').deleteOne({
        _id: id.toString()
      });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting file permission:', error);
      return false;
    }
  }

  // Activity Logs
  async logActivity(log: InsertActivityLog): Promise<ActivityLog> {
    if (!this.db) throw new Error('Database not connected');
    
    try {
      const logId = new ObjectId().toString();
      const timestamp = new Date();
      
      await this.db.collection('activity_logs').insertOne({
        _id: logId,
        ...log,
        timestamp
      });
      
      const createdLog = await this.db.collection('activity_logs').findOne({
        _id: logId
      });
      
      return toActivityLog(createdLog) as ActivityLog;
    } catch (error) {
      console.error('Error logging activity:', error);
      throw new Error('Failed to log activity');
    }
  }

  async getActivityLogs(): Promise<ActivityLog[]> {
    if (!this.db) return [];
    
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
    if (!this.db) return [];
    
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