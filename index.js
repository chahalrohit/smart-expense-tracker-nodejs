import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import fs from "fs";
import path from "path";
import authRoutes from "./src/routes/auth.js";
import protectedRoutes from "./src/routes/protected.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Trust proxy for AWS load balancers
app.set("trust proxy", true);

/** CORS: Configure for production deployment */
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL?.split(",") || [] // Support multiple origins
        : process.env.CLIENT_URL || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Static files
app.use(express.static("public"));

// Body parsing middleware with larger limits for file uploads
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging for debugging
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

/** Health check for load balancer */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Load balancer health check (common AWS pattern)
app.get("/", (req, res) => {
  res.status(200).json({
    message: `Smart Expense Tracker API is running on port ${PORT}`,
    status: "success",
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

/** Safe JSON file read with better error handling */
let Types = [];
try {
  const dataPath = path.join(process.cwd(), "src/data/mainList.json");
  if (fs.existsSync(dataPath)) {
    const rawData = fs.readFileSync(dataPath, "utf8");
    Types = JSON.parse(rawData);
    console.log(`✅ Loaded ${Types.length} items from mainList.json`);
  } else {
    console.warn("⚠️  mainList.json not found, using empty array");
  }
} catch (e) {
  console.error("❌ Error loading mainList.json:", e.message);
  Types = [];
}

/** MongoDB Connection with retry logic */
/** MongoDB Connection with retry logic */
const connectToMongoDB = async (retries = 5) => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI environment variable is not set");
    }

    // Optional: disable buffering globally
    // mongoose.set('bufferCommands', false);

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10, // connection pool size
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false, // disable mongoose buffering
      // Do NOT include bufferMaxEntries (deprecated/removed)
      // Do NOT include useNewUrlParser / useUnifiedTopology in Mongoose 6+
    });

    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error(
      `❌ MongoDB connection error (${retries} retries left):`,
      err.message
    );

    if (retries > 0) {
      console.log(`Retrying MongoDB connection in 5 seconds...`);
      setTimeout(() => connectToMongoDB(retries - 1), 5000);
    } else {
      console.error("❌ Failed to connect to MongoDB after multiple retries");
      if (process.env.NODE_ENV !== "production") {
        process.exit(1);
      }
    }
  }
};

// Handle MongoDB connection events
mongoose.connection.on("connected", () => {
  console.log("✅ Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️  Mongoose disconnected from MongoDB");
});

// Connect to MongoDB
connectToMongoDB();

/** Routes */
app.use("/api/auth", authRoutes);
app.use("/api", protectedRoutes);

/** 404 handler */
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.path}`);
  error.status = 404;
  next(error);
});

/** Global error handler */
app.use((error, req, res, next) => {
  // Log error for debugging
  console.error(`Error ${error.status || 500}:`, error.message);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== "production";

  res.status(error.status || 500).json({
    success: false,
    error: isDevelopment ? error.message : "Internal Server Error",
    ...(isDevelopment && { stack: error.stack }),
  });
});

/** Graceful shutdown handling */
/** Graceful shutdown handling (Mongoose 7/8 safe) */
const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);
  try {
    // 1) Stop accepting new HTTP connections
    if (server && server.listening) {
      await new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
      console.log("✅ HTTP server closed");
    }

    // 2) Close Mongo connections (no callback in Mongoose 7/8)
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false); // don't force close; let ops finish
      // or: await mongoose.disconnect();
      console.log("✅ MongoDB connection closed");
    }

    console.log("👋 Graceful shutdown completed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during server shutdown:", err);
    process.exit(1);
  }
};

// Signals
["SIGTERM", "SIGINT"].forEach((sig) =>
  process.on(sig, () => gracefulShutdown(sig))
);

// Optional: don't kill the process immediately on unhandled rejections during shutdown
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
  process.exit(1);
});

/** Start server - bind to all interfaces for AWS EC2 */
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Smart Expense Tracker API started successfully`);
  console.log(`📍 Server running on 0.0.0.0:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `💾 MongoDB: ${
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
    }`
  );
});
