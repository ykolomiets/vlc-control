import pLimit from "p-limit";
const limitConcurrency = (() => {
  const limit = pLimit(1);
  return (fn) =>
    (...args) =>
      limit(fn, ...args);
})();

export function buildVlcPlayersControl({ startVlcPlayer, maxPlayers }) {
  let mainPlayer = null;
  const secondaryPlayers = new Set();

  const getPlayer = (playerId) => {
    const player = getAllPlayers().find((p) => p.id === playerId);
    if (!player) {
      throw new Error(`No active player with id ${playerId}`);
    }
    return player;
  };

  const getAllPlayers = () => {
    const players = [...secondaryPlayers];
    if (mainPlayer) {
      players.push(mainPlayer);
    }
    return players;
  };

  const startMainPlayer = limitConcurrency(async () => {
    if (mainPlayer) {
      console.warn("Main player is running already...");
      return;
    }

    mainPlayer = await startVlcPlayer({
      noVideo: false,
      closeOrErrorCallback: () => {
        mainPlayer = null;
      },
    });
  });

  const addSecondaryPlayer = limitConcurrency(async () => {
    const player = await startVlcPlayer({
      noVideo: true,
      closeOrErrorCallback: () => {
        secondaryPlayers.delete(player);
      },
    });

    secondaryPlayers.add(player);

    await synchronizePlayers();
  });

  const closePlayer = async (playerId) => {
    const player = getPlayer(playerId);
    player.actions.close();
    if (player === mainPlayer) {
      mainPlayer = null;
      await Promise.all([...secondaryPlayers].map((p) => p.actions.pause()));
    } else {
      secondaryPlayers.delete(player);
    }
  };

  const refreshState = async () => {
    await Promise.all(getAllPlayers().map((p) => p.refreshState()));
  };

  const getState = () => {
    return {
      mainPlayer:
        mainPlayer && !mainPlayer.getState().isClosed
          ? {
              id: mainPlayer.id,
              ...mainPlayer.getState(),
            }
          : null,
      secondaryPlayers: [...secondaryPlayers]
        .map((p) => ({
          id: p.id,
          ...p.getState(),
        }))
        .filter((p) => !p.isClosed),
      maxPlayers,
    };
  };

  const togglePause = async () => {
    await Promise.all(getAllPlayers().map((p) => p.actions.togglePause()));
  };

  const synchronizePlayers = async () => {
    await Promise.all(getAllPlayers().map((p) => p.actions.pause()));
    if (mainPlayer) {
      const { time } = mainPlayer.getState();
      await Promise.all(getAllPlayers().map((p) => p.actions.seekTo(time)));
    }
  };

  const toggleFullscreen = () => mainPlayer.actions.toggleFullscreen();

  const setVolume = async (playerId, value) => {
    await getPlayer(playerId).actions.setVolume(value);
  };

  const setAudiotrack = async (playerId, trackId) => {
    await getPlayer(playerId).actions.setAudiotrack(trackId);
  };

  const setAudiodevice = async (playerId, deviceId) => {
    await getPlayer(playerId).actions.setAudiodevice(deviceId);
  };

  const setSubtitleTrack = async (playerId, trackId) => {
    await getPlayer(playerId).actions.setSubtitleTrack(trackId);
  };

  const seekTo = async (time) => {
    await Promise.all(getAllPlayers().map(p => p.actions.seekTo(time)));
  };

  const closeAll = () => Promise.all(getAllPlayers().map((p) => p.close()));

  process.on("exit", closeAll);

  return {
    refreshState,
    getState,
    startMainPlayer,
    addSecondaryPlayer,
    synchronizePlayers,
    closePlayer,
    toggleFullscreen,
    togglePause,
    setAudiotrack,
    setAudiodevice,
    setVolume,
    setSubtitleTrack,
    seekTo,
  };
}
