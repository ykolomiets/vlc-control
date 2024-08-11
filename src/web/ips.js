import { networkInterfaces } from "node:os";

export const ips = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i.family === "IPv4")
  .map((i) => i.address);
