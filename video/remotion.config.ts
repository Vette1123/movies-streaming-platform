import { Config } from '@remotion/cli/config'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

Config.setEntryPoint('./src/index.ts')
// PNG frames: a JPEG generation before H.264 is where dark gradients start to band.
Config.setVideoImageFormat('png')
Config.setOverwriteOutput(true)
Config.setDelayRenderTimeoutInMilliseconds(120_000)
Config.setConcurrency(4)
// `@/` resolves to the repo root, as it does in the app.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias ?? {}),
      '@': resolve(process.cwd(), '..'),
    },
  },
}))

// Prefer the Chrome already on the machine over downloading Remotion's headless shell.
const browser = [
  process.env.REMOTION_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p): p is string => !!p && existsSync(p))
if (browser) Config.setBrowserExecutable(browser)
