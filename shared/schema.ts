import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles
export const UserRole = {
  ADMIN: "admin",
  EDITOR: "editor",
  VIEWER: "viewer"
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default(UserRole.VIEWER),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
});

// Files table
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  ownerId: integer("owner_id").notNull(),
  parentId: integer("parent_id"),
  isFolder: boolean("is_folder").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFileSchema = createInsertSchema(files).pick({
  name: true,
  path: true,
  type: true,
  size: true,
  ownerId: true,
  parentId: true,
  isFolder: true,
});

// File permissions table
export const filePermissions = pgTable("file_permissions", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").notNull(),
  userId: integer("user_id").notNull(),
  canRead: boolean("can_read").notNull().default(true),
  canWrite: boolean("can_write").notNull().default(false),
  canDelete: boolean("can_delete").notNull().default(false),
  canShare: boolean("can_share").notNull().default(false),
});

export const insertFilePermissionSchema = createInsertSchema(filePermissions).pick({
  fileId: true,
  userId: true,
  canRead: true,
  canWrite: true,
  canDelete: true,
  canShare: true,
});

// Activity logs table
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).pick({
  userId: true,
  action: true,
  details: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export type FilePermission = typeof filePermissions.$inferSelect;
export type InsertFilePermission = z.infer<typeof insertFilePermissionSchema>;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
