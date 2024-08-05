import { select, checkbox } from "@inquirer/prompts";

const buildName = (audiotrack) => {
	const parts = [`[${audiotrack.idx}]`];
	if (audiotrack.title) {
		parts.push(audiotrack.title);
	}
	if (audiotrack.language) {
		parts.push(`(${audiotrack.language})`);
	}
	return parts.join(" ");
};

export async function selectMainAudiotrack(audiotracks) {
	const answer = await select({
		message: "Select a main audiotrack",
		choices: audiotracks.map(audiotrack => ({
			value: audiotrack,
			name: buildName(audiotrack)
		})),
	});

	return answer;
}

export async function selectSecondaryAudiotracks(audiotracks) {
	const answer = await checkbox({
		message: "Select secondary audiotracks",
		choices: audiotracks.map(audiotrack => ({
			value: audiotrack,
			name: buildName(audiotrack)
		})),
	});

	return answer;
}
