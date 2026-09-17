import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MAIN_ACTIVITY = `package ar.monix.banco;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    WindowInsetsControllerCompat insets =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    insets.setAppearanceLightStatusBars(true);
    configurarWebView();
  }

  @Override
  public void onStart() {
    super.onStart();
    configurarWebView();
  }

  private void configurarWebView() {
    if (getBridge() == null || getBridge().getWebView() == null) return;
    WebView webView = getBridge().getWebView();
    WebSettings settings = webView.getSettings();
    settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    webView.setWebChromeClient(new MonixChromeClient());
  }

  private class MonixChromeClient extends BridgeWebChromeClient {
    MonixChromeClient() {
      super(getBridge());
    }

    @Override
    public void onPermissionRequest(final PermissionRequest request) {
      boolean needCam = false;
      boolean needMic = false;
      for (String resource : request.getResources()) {
        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) needCam = true;
        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) needMic = true;
      }
      boolean camOk = !needCam || ContextCompat.checkSelfPermission(
        MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
      boolean micOk = !needMic || ContextCompat.checkSelfPermission(
        MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
      if (camOk && micOk) {
        runOnUiThread(() -> request.grant(request.getResources()));
        return;
      }
      super.onPermissionRequest(request);
    }
  }
}
`

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

if (!xml.includes('monix-homebanking.vercel.app')) {
  xml = xml.replace(
    '<category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>',
    `<category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="monix-homebanking.vercel.app" />
            </intent-filter>`,
  )
}

writeFileSync(file, xml)

const main = resolve('android/app/src/main/java/ar/monix/banco/MainActivity.java')
if (existsSync(main)) writeFileSync(main, MAIN_ACTIVITY)
