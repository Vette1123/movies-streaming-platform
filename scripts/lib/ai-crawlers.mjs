// The AI crawlers the site wants: config/ai-crawlers.json, flattened for the
// two scripts that match on them (the WAF allow rule and the health check).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const file = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../config/ai-crawlers.json'
)
const { search, knowledge } = JSON.parse(fs.readFileSync(file, 'utf8'))

export const AI_CRAWLER_UAS = [...search, ...knowledge]
