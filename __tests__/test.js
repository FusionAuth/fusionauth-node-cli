import { allKickstarts } from "./kickstart/index.js";
import { postInstall } from "./postInstall/index.js";
import { telemetry } from "./telemetry/index.js";


postInstall()
telemetry()
allKickstarts()