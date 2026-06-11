#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const dataDir = path.join(__dirname, '..', 'data')
const manifestPath = path.join(dataDir, 'manifest.json')

function getDataFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      getDataFiles(fullPath, files)
    } else if (/\.(csv|json|md)$/.test(entry) && entry !== 'manifest.json') {
      files.push(fullPath)
    }
  }
  return files
}

function sha256(filePath) {
  const data = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(data).digest('hex')
}

const dataFiles = getDataFiles(dataDir)
const manifest = {}

for (const file of dataFiles) {
  const relativePath = path.relative(dataDir, file).replace(/\\/g, '/')
  manifest[relativePath] = sha256(file)
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Generated manifest with ${dataFiles.length} entries at ${manifestPath}`)
