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

const main = resolve('android/app/src/main/java/ar/monix/banco/MainActivity.java')
if (existsSync(main)) {
  writeFileSync(
    main,
    `package ar.monix.banco;

import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    WindowInsetsControllerCompat insets =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    insets.setAppearanceLightStatusBars(true);
    if (getBridge() != null && getBridge().getWebView() != null) {
      WebSettings settings = getBridge().getWebView().getSettings();
      settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
      settings.setMediaPlaybackRequiresUserGesture(false);
    }
  }
}
`,
  )
}
