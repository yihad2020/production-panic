const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

let leaderboard = [
  {
    id: 1,
    name: "SystemAdmin",
    score: 420,
    date: new Date().toISOString(),
  },
];

app.get("/", (req, res) => {
  res.json({ message: "Production Panic API is running" });
});

app.get("/api/leaderboard", (req, res) => {
  const sorted = leaderboard.sort((a, b) => b.score - a.score).slice(0, 10);
  res.json(sorted);
});

app.post("/api/leaderboard", (req, res) => {
  const { name, score } = req.body;
  if (!name || typeof score !== "number") {
    return res.status(400).json({ message: "Name and score are required" });
  }
  const newEntry = {
    id: Date.now(),
    name,
    score,
    date: new Date().toISOString(),
  };
  leaderboard.push(newEntry);
  res.status(201).json(newEntry);
});

// ✅ Export for Vercel instead of app.listen
module.exports = app;
