import express from "express";
import auth from "../middleware/auth.js";

const router = express.Router();

router.get("/protected", auth, (req, res) => {
  res.json({
    message: "This is protected data accessible only with valid token",
    userId: req.user,
  });
});

export default router;
