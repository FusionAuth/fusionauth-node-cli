import { postInstall } from "./postInstall/index.js";
import { telemetry } from "./telemetry/index.js";
import { variableSubstitution } from "./kickstart/variable-substitution.test.js";
import { validator } from "./kickstart/validator.test.js";
import { apply } from "./apply/index.js";


postInstall()
telemetry()
variableSubstitution()
validator()
apply()