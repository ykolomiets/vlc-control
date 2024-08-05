import { InvalidArgumentError } from "commander";

export function parsePortList(value) {
	const regexp = /^\d+(?:,\d+)*$/;
	if (!regexp.test(value)) {
		throw new InvalidArgumentError("Not a comma-separated list of numbers.");
	}

	const ports = value
		.split(",")
		.map(v => {
			const port = parseInt(v, 10);
			if (port < 1024 || port > 65535) {
				throw new InvalidArgumentError("Port range is [1024-65535]");
			}
			return port;
		})

	return ports;
}
