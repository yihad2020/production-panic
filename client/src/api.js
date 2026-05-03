const API_URL = '/api';;

export async function getLeaderboard() {
  const response = await fetch(`${API_URL}/leaderboard`);

  if (!response.ok) {
    throw new Error("Failed to fetch leaderboard");
  }

  return response.json();
}

export async function submitScore(name, score) {
  const response = await fetch(`${API_URL}/leaderboard`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, score }),
  });

  if (!response.ok) {
    throw new Error("Failed to submit score");
  }

  return response.json();
}
