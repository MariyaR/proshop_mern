import { pipeline } from '@huggingface/transformers'
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const QDRANT_URL = 'http://localhost:6333'
const COLLECTION = 'project-docs'
const VECTOR_SIZE = 1024
const BATCH_SIZE = 50
const MIN_CHUNK_LENGTH = 50

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getCategory(filePath) {
  if (filePath.includes('/adrs/') || filePath.includes('\\adrs\\')) return 'adr'
  if (filePath.includes('/incidents/') || filePath.includes('\\incidents\\')) return 'incident'
  if (filePath.includes('/runbooks/') || filePath.includes('\\runbooks\\')) return 'runbook'
  if (filePath.includes('/api/') || filePath.includes('\\api\\')) return 'api'
  if (filePath.includes('/pages/') || filePath.includes('\\pages\\')) return 'page'
  if (filePath.includes('/features/') || filePath.includes('\\features\\')) return 'feature'
  return 'core'
}

function chunkMarkdown(text) {
  const lines = text.split('\n')
  const chunks = []
  let title = ''
  let currentSection = ''
  let currentLines = []

  const flush = () => {
    const content = currentLines.join('\n').trim()
    if (content.length >= MIN_CHUNK_LENGTH) {
      chunks.push({ section: currentSection, text: content })
    }
    currentLines = []
  }

  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim()
      currentLines.push(line)
    } else if (line.match(/^#{2,3}\s/)) {
      flush()
      currentSection = line.replace(/^#{2,3}\s+/, '').trim()
      currentLines = [line]
    } else {
      currentLines.push(line)
    }
  }
  flush()

  return { title, chunks }
}

async function walkDir(dir) {
  const files = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkDir(fullPath)))
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }
  return files
}

async function ensureCollection() {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`)
  if (res.status === 200) {
    console.log(`Collection "${COLLECTION}" already exists — recreating`)
    await fetch(`${QDRANT_URL}/collections/${COLLECTION}`, { method: 'DELETE' })
  }
  await fetch(`${QDRANT_URL}/collections/${COLLECTION}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    }),
  })
  console.log(`Collection "${COLLECTION}" created`)
}

async function upsertBatch(points) {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Qdrant upsert failed: ${body}`)
  }
}

async function main() {
  console.log('Loading BAAI/bge-m3 model (first run downloads ~1.1 GB)...')
  const embedder = await pipeline('feature-extraction', 'BAAI/bge-m3')
  console.log('Model ready')

  await ensureCollection()

  const files = await walkDir(__dirname)
  console.log(`Found ${files.length} markdown files`)

  const points = []
  let pointId = 0

  for (const file of files) {
    const relativePath = path.relative(__dirname, file)
    const content = await readFile(file, 'utf-8')
    const category = getCategory(file)
    const { title, chunks } = chunkMarkdown(content)

    console.log(`  ${relativePath} → ${chunks.length} chunks`)

    for (let i = 0; i < chunks.length; i++) {
      const { section, text } = chunks[i]
      const output = await embedder(text, { pooling: 'mean', normalize: true })
      const vector = Array.from(output.data)

      points.push({
        id: pointId++,
        vector,
        payload: {
          text,
          source: relativePath,
          category,
          title: title || path.basename(file, '.md'),
          section,
          chunk_index: i,
        },
      })
    }
  }

  console.log(`\nUpserting ${points.length} points in batches of ${BATCH_SIZE}...`)
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE)
    await upsertBatch(batch)
    console.log(`  ${Math.min(i + BATCH_SIZE, points.length)}/${points.length} done`)
  }

  console.log('\nIngestion complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
