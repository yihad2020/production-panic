import { useEffect, useState, useRef, useCallback } from "react";
import { getLeaderboard, submitScore } from "./api";
import "./App.css";

const INCIDENT_TYPES = [
  { title: "API Timeout",      icon: "🌐", severity: "medium",   points: 20, damage: 15, lifetime: 7  },
  { title: "Database Overload",icon: "🗄️",  severity: "critical", points: 40, damage: 25, lifetime: 6  },
  { title: "Auth Failure",     icon: "🔐", severity: "high",     points: 30, damage: 20, lifetime: 6  },
  { title: "UI Bug",           icon: "🎨", severity: "low",      points: 10, damage: 8,  lifetime: 9  },
  { title: "Payment Error",    icon: "💳", severity: "critical", points: 45, damage: 30, lifetime: 5  },
];

const SPEED_BASE = 0.25;   // % per frame
const SPEED_SCALE = 0.12;  // extra speed per severity level

const severitySpeed = { low: 0, medium: 1, high: 2, critical: 3 };

function makeIncident() {
  const type = INCIDENT_TYPES[Math.floor(Math.random() * INCIDENT_TYPES.length)];
  const angle = Math.random() * Math.PI * 2;
  const spd = SPEED_BASE + severitySpeed[type.severity] * SPEED_SCALE;
  return {
    id: crypto.randomUUID(),
    ...type,
    timeLeft: type.lifetime,
    // position in % of container
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 80,
    // velocity in % per animation frame
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
  };
}

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver]       = useState(false);
  const [incidents, setIncidents]     = useState([]);
  const [score, setScore]             = useState(0);
  const [health, setHealth]           = useState(100);
  const [eventLog, setEventLog]       = useState([]);
  const [playerName, setPlayerName]   = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");

  const rafRef      = useRef(null);
  const healthRef   = useRef(100);
  const gameRef     = useRef(false);

  const addLog = useCallback((msg) => {
    setEventLog((prev) => [msg, ...prev].slice(0, 8));
  }, []);

  // ── Leaderboard ──
  async function loadLeaderboard() {
    try {
      setLeaderboardError("");
      const data = await getLeaderboard();
      setLeaderboard(data);
    } catch {
      setLeaderboardError("Could not load leaderboard.");
    }
  }

  async function handleSubmitScore(event) {
    event.preventDefault();
    const cleanName = playerName.trim();
    if (!cleanName) { setLeaderboardError("Enter your name first."); return; }
    try {
      setLeaderboardError("");
      await submitScore(cleanName, score);
      setScoreSubmitted(true);
      setPlayerName("");
      await loadLeaderboard();
      addLog(`🏆 Score submitted as ${cleanName}`);
    } catch {
      setLeaderboardError("Could not submit score.");
    }
  }

  useEffect(() => { loadLeaderboard(); }, []);

  // ── Game start / reset ──
  function startGame() {
    setGameStarted(true);
    setGameOver(false);
    setIncidents([]);
    setScore(0);
    setHealth(100);
    healthRef.current = 100;
    gameRef.current = true;
    setPlayerName("");
    setScoreSubmitted(false);
    setLeaderboardError("");
    setEventLog(["System booted. Monitoring production..."]);
  }

  // ── Spawn interval ──
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const id = setInterval(() => {
      if (!gameRef.current) return;
      setIncidents((prev) => {
        const inc = makeIncident();
        addLog(`${inc.icon} New incident: ${inc.title}`);
        return [...prev, inc];
      });
    }, 2000);
    return () => clearInterval(id);
  }, [gameStarted, gameOver, addLog]);

  // ── Countdown timer (1s tick) ──
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const id = setInterval(() => {
      if (!gameRef.current) return;
      setIncidents((prev) => {
        const next = [];
        for (const inc of prev) {
          const tl = inc.timeLeft - 1;
          if (tl <= 0) {
            const newHealth = Math.max(0, healthRef.current - inc.damage);
            healthRef.current = newHealth;
            setHealth(newHealth);
            addLog(`❌ ${inc.title} expired. -${inc.damage} health`);
            if (newHealth <= 0) {
              gameRef.current = false;
              setGameOver(true);
              setGameStarted(false);
              setIncidents([]);
              addLog("🔥 Production went down. Game over.");
              return [];
            }
          } else {
            next.push({ ...inc, timeLeft: tl });
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [gameStarted, gameOver, addLog]);

  // ── Animation loop: move dots ──
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    function tick() {
      setIncidents((prev) =>
        prev.map((inc) => {
          let { x, y, vx, vy } = inc;
          x += vx;
          y += vy;
          // Bounce off edges (5%–95%)
          if (x < 5  || x > 95) { vx = -vx; x = Math.max(5, Math.min(95, x)); }
          if (y < 5  || y > 95) { vy = -vy; y = Math.max(5, Math.min(95, y)); }
          // Small random drift
          vx += (Math.random() - 0.5) * 0.03;
          vy += (Math.random() - 0.5) * 0.03;
          // Cap speed
          const speed = Math.hypot(vx, vy);
          const maxSpd = SPEED_BASE + severitySpeed[inc.severity] * SPEED_SCALE + 0.2;
          if (speed > maxSpd) { vx = (vx / speed) * maxSpd; vy = (vy / speed) * maxSpd; }
          return { ...inc, x, y, vx, vy };
        })
      );
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameStarted, gameOver]);

  // ── Fix incident (click) ──
  function fixIncident(id, e) {
    e.stopPropagation();
    setIncidents((prev) => {
      const inc = prev.find((i) => i.id === id);
      if (!inc) return prev;
      setScore((s) => s + inc.points);
      addLog(`✅ Fixed: ${inc.title} +${inc.points} pts`);
      return prev.filter((i) => i.id !== id);
    });
  }

  const criticalCount = incidents.filter((i) => i.severity === "critical").length;

  return (
    <main className="app">
      {/* ── Hero ── */}
      <section className="hero">
        <div>
          <p className="eyebrow">Production Monitoring // Live Map</p>
          <h1>Production Panic</h1>
          <p className="subtitle">Click bugs on the map before they crash your system.</p>
        </div>
        <button className="primary-button" onClick={startGame}>
          {gameOver ? "Restart" : gameStarted ? "Restart" : "Start Game"}
        </button>
      </section>

      {/* ── Stats ── */}
      <section className="stats-grid">
        <div className="stat-card">
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div className="stat-card">
          <span>System Health</span>
          <strong>{health}%</strong>
          <div className="health-bar"><div style={{ width: `${health}%` }} /></div>
        </div>
        <div className="stat-card">
          <span>Active Incidents</span>
          <strong>{incidents.length}</strong>
        </div>
        <div className="stat-card">
          <span>Critical</span>
          <strong>{criticalCount}</strong>
        </div>
      </section>



      {/* ── Dashboard ── */}
      <section className="dashboard">

        {/* ── Map ── */}
        <div className="incidents-panel">
          <div className="panel-header">
            <h2>Live Incident Map</h2>
            <span>{gameStarted ? "● MONITORING" : "○ IDLE"}</span>
          </div>

          <div className="map-canvas">
            {/* Game Over overlay */}
            {gameOver && (
              <div className="game-over-overlay">
                <div className="game-over-box">
                  <h2>⚠ Production crashed.</h2>
                  <p>Final score: {score}</p>
                  <button className="primary-button" onClick={startGame}>Try Again</button>
                </div>
              </div>
            )}
            {/* Empty states */}
            {!gameStarted && !gameOver && (
              <div className="empty-state">Press Start Game to begin monitoring</div>
            )}
            {gameStarted && incidents.length === 0 && (
              <div className="empty-state">All systems nominal...</div>
            )}

            {/* Incident dots */}
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className={`incident-dot ${inc.severity}`}
                style={{ left: `${inc.x}%`, top: `${inc.y}%` }}
                onClick={(e) => fixIncident(inc.id, e)}
              >
                <div className="dot-core">
                  <div className="dot-ring" />
                  <div className="dot-ring-2" />
                  <div className="dot-icon">{inc.icon}</div>
                </div>

                {/* Tooltip */}
                <div className="dot-tooltip">
                  <strong>{inc.title}</strong>
                  <span>{inc.severity.toUpperCase()} · {inc.timeLeft}s · +{inc.points}pts</span>
                </div>

                {/* Timer bar */}
                <div className="dot-timer-bar">
                  <div
                    className="dot-timer-fill"
                    style={{ width: `${(inc.timeLeft / inc.lifetime) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Side Stack ── */}
        <aside className="side-stack">

          {/* Leaderboard */}
          <section className="panel leaderboard-panel">
            <div className="panel-header">
              <h2>Leaderboard</h2>
              <button className="ghost-button" onClick={loadLeaderboard}>Refresh</button>
            </div>

            {gameOver && !scoreSubmitted && (
              <form className="score-form" onSubmit={handleSubmitScore}>
                <label htmlFor="playerName">Submit your score</label>
                <div className="score-form-row">
                  <input
                    id="playerName"
                    type="text"
                    placeholder="Your callsign"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                  />
                  <button type="submit">Save</button>
                </div>
              </form>
            )}

            {scoreSubmitted && <p className="success-message">Score transmitted.</p>}
            {leaderboardError && <p className="error-message">{leaderboardError}</p>}

            <div className="leaderboard-list">
              {leaderboard.map((entry, i) => (
                <div className="leaderboard-row" key={entry.id}>
                  <span>#{i + 1}</span>
                  <strong>{entry.name}</strong>
                  <em>{entry.score}</em>
                </div>
              ))}
            </div>
          </section>

          {/* Event Log */}
          <section className="panel log-panel">
            <div className="panel-header">
              <h2>Event Log</h2>
            </div>
            <div className="log-list">
              {eventLog.map((ev, i) => (
                <p key={`${ev}-${i}`}>{ev}</p>
              ))}
            </div>
          </section>

        </aside>
      </section>
    </main>
  );
}

export default App;
