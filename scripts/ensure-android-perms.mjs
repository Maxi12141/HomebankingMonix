import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve('android/app/src/main/AndroidManifest.xml')
if (!existsSync(file)) process.exit(0)

let xml = readFileSync(file, 'utf8')
const perms = [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.NFC',
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT',
  'android.permission.POST_NOTIFICATIONS',
]

for (const name of perms) {
  if (xml.includes(`android:name="${name}"`)) continue
  xml = xml.replace(
    '</manifest>',
    `    <uses-permission android:name="${name}" />\n</manifest>\n`,
  )
}

if (!xml.includes('android.hardware.camera.any')) {
  xml = xml.replace(
    '</manifest>',
    `    <uses-feature android:name="android.hardware.camera" android:required="false" />\n    <uses-feature android:name="android.hardware.camera.any" android:required="false" />\n</manifest>\n`,
  )
}

writeFileSync(file, xml)
