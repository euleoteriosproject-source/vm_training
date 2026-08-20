import path from "node:path";
import { generatePoster } from "../../lib/media/ffmpeg.ts";
import { log, parseArgs } from "./shared.ts";
const args = parseArgs();
if (!args.input || !args.output) throw new Error("Informe --input e --output");
await generatePoster(path.resolve(args.input), path.resolve(args.output));
log("PROCESS", `Poster gerado: ${args.output}`);
