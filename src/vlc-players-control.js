export function buildVlcPlayersControl(mainVlcPlayer, secondaryVlcPlayers) {
	const allPlayers = [mainVlcPlayer, ...secondaryVlcPlayers];

	const getStatus = async () => {
		const [mainStatus, ...secondaryStatuses] = await Promise.all(
			allPlayers.map(async p => ({
				id: p.id,
				name: p.name,
				...(await p.getStatus()),
			}))
		);

		return {
			filename: mainStatus.information.category.meta.filename,
			state: mainStatus.state,
			time: mainStatus.time,
			length: mainStatus.length,
			fullscreen: !!mainStatus.fullscreen,
			players: [mainStatus, ...secondaryStatuses].map(s => ({
				id: s.id,
				name: s.name,
				closed: s.closed ?? false,
				volume: s.volume,
				time: s.time,
			}))
		};
	};

	const togglePause = async () => {
		await Promise.all(allPlayers.map(p => p.togglePause()));
	};

	const synchronize = async () => {
		await Promise.all(allPlayers.map(p => p.pause()));
		const mainStatus = await mainVlcPlayer.getStatus();
		await Promise.all(allPlayers.map(p => p.seekTo(mainStatus.time)));
	};

	const toggleFullscreen = () => mainVlcPlayer.toggleFullscreen();

	const setVolume = async (playerId, value) => {
		const player = allPlayers.find(p => p.id == playerId);
		if (!player) {
			throw new Error("No active player with such id");
		}
		await player.setVolume(value);
	}

	const closeAll = () => Promise.all(allPlayers.map(p => p.close()));

	return {
		getStatus,
		togglePause,
		synchronize,
		toggleFullscreen,
		setVolume,
		closeAll,
	};
}
