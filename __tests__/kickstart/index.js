import {describe} from "node:test";
import { kickstartInstall } from "./install.js";
import { kickstartStart } from "./start.js";
import { kickstartUtils } from "./utils.js";


export function allKickstarts() {
  describe('Kickstart commands', () => {
    kickstartUtils()
    kickstartInstall();
    kickstartStart();
  })

}