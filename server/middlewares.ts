import { Request, Response, NextFunction } from "express";
import { UserRole } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";

// Auth middleware
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Role-based middleware
export const hasRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }
    
    next();
  };
};

// Admin-only middleware
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  if (req.user.role !== UserRole.ADMIN) {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }
  
  next();
};

// Create uploads directory if it doesn't exist
export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer for file uploads
export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const userId = req.user?.id || 'anonymous';
      const userDir = path.join(UPLOAD_DIR, userId.toString());
      
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      
      cb(null, userDir);
    },
    filename: (req, file, cb) => {
      // Generate a unique filename to prevent overwriting
      const uniqueSuffix = randomBytes(8).toString('hex');
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  }
});

// Setup in-memory file storage
export const inMemoryFiles = new Map<string, Buffer>();
