#!/usr/bin/env node
/**
 * Update build number with current timestamp
 * Run before building: node scripts/update-build.js
 */

const fs = require('fs')
const path = require('path')

// Generate timestamp build number (YYYYMMDD.HHMM)
const now = new Date()
const year = now.getFullYear()
const month = String(now.getMonth() + 1).padStart(2, '0')
const day = String(now.getDate()).padStart(2, '0')
const hour = String(now.getHours()).padStart(2, '0')
const minute = String(now.getMinutes()).padStart(2, '0')

const buildNumber = `${year}${month}${day}.${hour}${minute}`

// Read app.json for version
const appJsonPath = path.join(__dirname, '..', 'app.json')
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'))
const appVersion = appJson.expo.version

// Read current build.ts
const buildTsPath = path.join(__dirname, '..', 'src', 'config', 'build.ts')
let buildTs = fs.readFileSync(buildTsPath, 'utf8')

// Update BUILD_NUMBER
buildTs = buildTs.replace(
  /export const BUILD_NUMBER = '[^']+'/,
  `export const BUILD_NUMBER = '${buildNumber}'`
)

// Update APP_VERSION
buildTs = buildTs.replace(
  /export const APP_VERSION = '[^']+'/,
  `export const APP_VERSION = '${appVersion}'`
)

// Write updated file
fs.writeFileSync(buildTsPath, buildTs)

console.log(`✅ Updated build number: ${buildNumber}`)
console.log(`✅ App version: ${appVersion}`)

