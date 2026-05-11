import fs from 'node:fs'
import { createConfig } from './utils.js'

export function runPostinstall() {
  try {
    const dir = 'dist/.fa'   
    createConfig(dir)

  } catch(e) {
    console.log(e)
  }
}

runPostinstall()