import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import fs from "fs";
import path from "path";
import authRoutes from "./src/routes/auth.js";
import protectedRoutes from "./src/routes/protected.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

/** CORS: allow your client URL if set, otherwise open during testing */
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*", // Postman doesn't need CORS, this is for browsers
    credentials: true,
  })
);

app.use(express.static("public"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/** Health check */
app.get("/health", (_, res) => res.send("ok"));

/** (Optional) Safe JSON file read */
let Types = [];
try {
  const rawData = fs.readFileSync(
    path.join(process.cwd(), "src/data/mainList.json"),
    "utf8"
  );
  Types = JSON.parse(rawData);
} catch (e) {
  console.warn("mainList.json not found or invalid JSON. Skipping…");
}

/** Mongo */
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/** Routes */
app.use("/api/auth", authRoutes); // e.g. POST /api/auth/login
app.use("/api", protectedRoutes);

/** Root */
app.get("/", (req, res) => {
  res.json({
    message: `Smart Expense Tracker API is running on port ${PORT}`,
    status: "success",
  });
});

/** 404 + error handlers */
app.use((req, res, next) => next({ status: 404, message: "Route not found" }));
app.use((error, req, res, next) => {
  res
    .status(error.status || 500)
    .json({ success: false, error: error.message || "Internal Server Error" });
});

/** Single listen — bind to all interfaces so EC2 can expose it */
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 API listening on 0.0.0.0:${PORT}`)
);
