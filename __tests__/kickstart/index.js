import {describe} from "node:test";
import { kickstartInstall } from "./install.js";


export function allKickstarts() {
  describe('Kickstart commands', () => {
    kickstartInstall();

  })

}