import { useCallback, useEffect, useState } from "react";
import { loadToken, saveToken } from "./api";
import { AuthScreen } from "./screens/Auth";
import { GameScreen } from "./screens/Game";
import { LobbyScreen, roomErrorText } from "./screens/Lobby";
import { RoomScreen } from "./screens/Room";
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

  // T14: a room link (/r/KX4P) joins that room as soon as we are signed in and connected.
  const [pendingCode, setPendingCode] = useState<string | null>(() => /^\/r\/([A-Za-z0-9]{4})\/?$/.exec(window.location.pathname)?.[1]?.toUpperCase() ?? null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const { connected, joinRoom, room } = game;
  useEffect(() => {
    if (!token || !connected || !pendingCode || game.game) return;
    const stored = (key: string, fallback: string) => {
      try {
        return localStorage.getItem(key) || fallback;
      } catch {
        return fallback;
      }
    };
    setPendingCode(null);
    void joinRoom(pendingCode, stored("lifesim.name", "Guest").trim(), stored("lifesim.career", "civilian")).then((r) => {
      if (!r?.ok) setRoomError(roomErrorText(r?.error));
    });
  }, [token, connected, pendingCode, joinRoom, game.game]);
  // The address bar shows the room's link while you are in it.
  useEffect(() => {
    const path = room && !game.game ? `/r/${room.code}` : "/";
    if (window.location.pathname !== path && !pendingCode) window.history.replaceState(null, "", path);
  }, [room, game.game, pendingCode]);

  if (!token) return <AuthScreen onAuthenticated={login} />;
  if (game.game?.recap) return <RecapScreen recap={game.game.recap} sessionId={game.game.sessionId} token={token} onBack={game.leaveGame} />;
  if (game.game) return <GameScreen game={game.game} decide={game.decide} playMischief={game.playMischief} previewScheme={game.previewScheme} boostScheme={game.boostScheme} guess={game.guess} ghostAction={game.ghostAction} connected={game.connected} />;
  if (game.room) return <RoomScreen room={game.room} myUserId={game.userId} update={game.updateRoom} leave={game.leaveRoom} start={game.startRoom} />;
  return <LobbyScreen token={token} onLogout={logout} {...game} roomError={roomError} />;
}
