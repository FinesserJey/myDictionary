import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.PORT || process.env.TRANSLATION_PROXY_PORT || 8787)
const langblyEndpoint = 'https://api.langbly.com/language/translate/v2'
const libreTranslateEndpoint = 'https://libretranslate.com/translate'
const distDirectory = fileURLToPath(new URL('../dist', import.meta.url))

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

const sendJson = (response, status, payload) => {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.PROXY_ALLOWED_ORIGIN || 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  response.end(JSON.stringify(payload))
}

const readBody = (request) => new Promise((resolve, reject) => {
  let body = ''
  request.on('data', (chunk) => {
    body += chunk
    if (body.length > 1_000_000) {
      reject(new Error('Request body is too large.'))
      request.destroy()
    }
  })
  request.on('end', () => resolve(body))
  request.on('error', reject)
})

const serveFrontend = async (request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const requestedFile = normalize(join(distDirectory, requestPath === '/' ? 'index.html' : requestPath))
  const safeFile = requestedFile.startsWith(distDirectory) ? requestedFile : join(distDirectory, 'index.html')

  try {
    const file = await readFile(safeFile)
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(safeFile)] || 'application/octet-stream',
    })
    response.end(file)
  } catch {
    const index = await readFile(join(distDirectory, 'index.html'))
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(index)
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': process.env.PROXY_ALLOWED_ORIGIN || 'http://localhost:5173',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    response.end()
    return
  }

  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === 'GET') {
    await serveFrontend(request, response)
    return
  }

  const requestPath = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname
  if (request.method !== 'POST' || requestPath !== '/api/translate') {
    sendJson(response, 404, { error: 'Not found' })
    return
  }

  try {
    const input = JSON.parse(await readBody(request))
    if (typeof input.q !== 'string' || typeof input.target !== 'string') {
      sendJson(response, 400, { error: 'q and target are required.' })
      return
    }

    const useLangbly = Boolean(process.env.LANGBLY_API_KEY)
    const endpoint = useLangbly ? langblyEndpoint : libreTranslateEndpoint
    const body = useLangbly
      ? input
      : { ...input, api_key: process.env.LIBRETRANSLATE_API_KEY }
    const headers = {
      'Content-Type': 'application/json',
      ...(useLangbly ? { 'X-API-Key': process.env.LANGBLY_API_KEY } : {}),
    }

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const result = await upstream.json()

    if (!upstream.ok) {
      sendJson(response, upstream.status, { error: result.error || 'Translation provider failed.' })
      return
    }

    const translatedText = useLangbly
      ? result.data?.translations?.[0]?.translatedText
      : result.translatedText

    sendJson(response, 200, { translatedText: translatedText || '' })
  } catch (error) {
    sendJson(response, 500, { error: error.message || 'Translation proxy failed.' })
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Translation proxy listening on port ${port}`)
})
