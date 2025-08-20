import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import fs from "fs";
import authRoutes from "./src/routes/auth.js";
import protectedRoutes from "./src/routes/protected.js"; // Ensure yeh file exist karti ho

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5001",
    credentials: true,
  })
);
app.use(express.static("public"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Data read karna agar zarurat ho
const rawData = fs.readFileSync("./src/data/mainList.json", "utf8");
const Types = JSON.parse(rawData);

const port = process.env.PORT || 5001;

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes); // Public Auth routes
app.use("/api", protectedRoutes); // Protected API routes

// Root/Test Route
app.get("/", (req, res) => {
  res.json({
    message: `Smart Expense Tracker API is running on port ${port}`,
    status: "success",
  });
});

// Handle Undefined Routes
app.use((req, res, next) => {
  next({ status: 404, message: "Route not found" });
});

// Global Error Handling Middleware
app.use((error, req, res, next) => {
  res.status(error.status || 500).json({
    success: false,
    error: error.message || "Internal Server Error",
  });
});

app.listen(port, () => {
  console.log(`🚀 Smart Expense Tracker Server running on port ${port}`);
});
