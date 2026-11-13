import { useCallback, useState } from "react";
import { loadToken, saveToken } from "./api";
import { AuthScreen } from "./screens/Auth";
import { GameScreen } from "./screens/Game";
import { LobbyScreen } from "./screens/Lobby";
import { RecapScreen } from "./screens/Recap";
import { useGame } from "./useGame";

export function App() {
  const [token, setToken] = useState<string | null>(() => loadToken());
  const logout = useCallback(() => {
    saveToken(null);
    setToken(null);
  }, []);
  const login = useCallback((t: string) => {
    saveToken(t);
    setToken(t);
  }, []);
  const game = useGame(token, logout);

  if (!token) return <AuthScreen onAuthenticated={login} />;
  if (game.game?.recap) return <RecapScreen recap={game.game.recap} sessionId={game.game.sessionId} token={token} onBack={game.leaveGame} />;
  if (game.game) return <GameScreen game={game.game} decide={game.decide} connected={game.connected} />;
  return <LobbyScreen token={token} onLogout={logout} {...game} />;
}
