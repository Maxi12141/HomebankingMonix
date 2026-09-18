package ar.monix.radio

import android.Manifest
import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Base64
import androidx.activity.result.ActivityResult
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.fragment.app.FragmentActivity
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.ByteArrayOutputStream
import java.io.File

@CapacitorPlugin(
  name = "MonixRadio",
  permissions = [
    Permission(strings = [Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.NFC, Manifest.permission.POST_NOTIFICATIONS], alias = "radio"),
    Permission(strings = [Manifest.permission.CAMERA], alias = "camera"),
    Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "mic")
  ]
)
class MonixRadioPlugin : Plugin(), NfcAdapter.ReaderCallback {
  companion object {
    @Volatile var instance: MonixRadioPlugin? = null
    var hcePayload: String = ""

    fun emitDevice(token: String, rssi: Int) {
      val data = JSObject()
      data.put("token", token)
      data.put("rssi", rssi)
      instance?.notifyListeners("deviceFound", data)
    }
  }

  override fun load() {
    instance = this
  }

  @PluginMethod
  fun pedirCamara(call: PluginCall) {
    if (getPermissionState("camera") == PermissionState.GRANTED) {
      call.resolve()
      return
    }
    requestPermissionForAlias("camera", call, "onCamara")
  }

  @PermissionCallback
  fun onCamara(call: PluginCall) {
    if (getPermissionState("camera") == PermissionState.GRANTED) {
      call.resolve()
    } else {
      call.reject("permission denied")
    }
  }

  private var fotoFile: File? = null

  private fun tieneCamara(): Boolean {
    return ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
  }

  @PluginMethod
  fun sacarFoto(call: PluginCall) {
    if (!tieneCamara()) {
      requestPermissionForAlias("camera", call, "onCamaraParaFoto")
      return
    }
    lanzarCamara(call)
  }

  @PermissionCallback
  fun onCamaraParaFoto(call: PluginCall) {
    if (tieneCamara()) {
      lanzarCamara(call)
    } else {
      call.reject("permission denied")
    }
  }

  private fun lanzarCamara(call: PluginCall) {
    val act = activity
    if (act == null) {
      call.reject("No se pudo abrir la cámara")
      return
    }
    act.runOnUiThread {
      try {
        val file = File(context.cacheDir, "monix-qr.jpg")
        file.parentFile?.mkdirs()
        if (file.exists()) file.delete()
        file.createNewFile()
        fotoFile = file
        val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)
        val flags = Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
          putExtra(MediaStore.EXTRA_OUTPUT, uri)
          clipData = ClipData.newRawUri("photo", uri)
          addFlags(flags)
        }
        startActivityForResult(call, intent, "onFotoTomada")
      } catch (e: Exception) {
        call.reject(e.message ?: "No se pudo abrir la cámara")
      }
    }
  }

  @ActivityCallback
  fun onFotoTomada(call: PluginCall, result: ActivityResult) {
    if (result.resultCode != Activity.RESULT_OK) {
      call.reject("cancelada")
      return
    }
    val file = fotoFile
    try {
      val bitmap = when {
        file != null && file.length() > 0 -> BitmapFactory.decodeFile(file.absolutePath)
        else -> result.data?.extras?.get("data") as? Bitmap
      }
      if (bitmap == null) {
        call.reject("No se guardó la foto")
        return
      }
      val max = 1600
      val scaled = if (bitmap.width <= max && bitmap.height <= max) bitmap else {
        val ratio = max.toFloat() / maxOf(bitmap.width, bitmap.height)
        Bitmap.createScaledBitmap(bitmap, (bitmap.width * ratio).toInt(), (bitmap.height * ratio).toInt(), true)
      }
      val out = ByteArrayOutputStream()
      scaled.compress(Bitmap.CompressFormat.JPEG, 82, out)
      val data = JSObject()
      data.put("dataUrl", "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP))
      call.resolve(data)
    } catch (e: Exception) {
      call.reject(e.message ?: "No se pudo leer la foto")
    } finally {
      file?.delete()
      fotoFile = null
    }
  }

  @PluginMethod
  fun pedirMic(call: PluginCall) {
    if (getPermissionState("mic") == PermissionState.GRANTED) {
      call.resolve()
      return
    }
    requestPermissionForAlias("mic", call, "onMic")
  }

  @PermissionCallback
  fun onMic(call: PluginCall) {
    if (getPermissionState("mic") == PermissionState.GRANTED) {
      call.resolve()
    } else {
      call.reject("permission denied")
    }
  }

  @PluginMethod
  fun pedirTodosLosPermisos(call: PluginCall) {
    val listos = getPermissionState("camera") == PermissionState.GRANTED
      && getPermissionState("mic") == PermissionState.GRANTED
      && getPermissionState("radio") == PermissionState.GRANTED
    if (listos) {
      call.resolve()
      return
    }
    requestAllPermissions(call, "onTodosLosPermisos")
  }

  @PermissionCallback
  fun onTodosLosPermisos(call: PluginCall) {
    call.resolve()
  }

  @PluginMethod
  fun abrirAjustes(call: PluginCall) {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
    intent.data = Uri.fromParts("package", context.packageName, null)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
    call.resolve()
  }

  private var bioPrompt: BiometricPrompt? = null

  @PluginMethod
  fun soportaBiometria(call: PluginCall) {
    val data = JSObject()
    data.put("ok", true)
    call.resolve(data)
  }

  @PluginMethod
  fun verificarBiometria(call: PluginCall) {
    call.setKeepAlive(true)
    val act = (activity as? FragmentActivity) ?: (bridge?.activity as? FragmentActivity)
    if (act == null) {
      call.reject("Reinstalá la APK de Monix para usar la huella")
      return
    }
    act.runOnUiThread {
      try {
        lanzarPromptHuella(act, call)
      } catch (e: Exception) {
        call.reject(e.message ?: "No se pudo abrir la huella")
      }
    }
  }

  private fun lanzarPromptHuella(act: FragmentActivity, call: PluginCall) {
    val weak = BiometricManager.Authenticators.BIOMETRIC_WEAK
    val conPin = weak or BiometricManager.Authenticators.DEVICE_CREDENTIAL
    val opciones = intArrayOf(conPin, weak)
    var ultimo: Exception? = null
    for (authenticators in opciones) {
      try {
        mostrarPromptHuella(act, call, authenticators)
        return
      } catch (e: Exception) {
        ultimo = e
      }
    }
    call.reject(ultimo?.message ?: "No se pudo abrir el lector de huella.")
  }

  private fun mostrarPromptHuella(act: FragmentActivity, call: PluginCall, authenticators: Int) {
    val usaPin = authenticators and BiometricManager.Authenticators.DEVICE_CREDENTIAL != 0
    bioPrompt = BiometricPrompt(
      act,
      ContextCompat.getMainExecutor(context),
      object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
          call.resolve()
        }

        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
          call.reject(errString.toString())
        }
      }
    )
    val builder = BiometricPrompt.PromptInfo.Builder()
      .setTitle("Monix")
      .setSubtitle("Confirmá con tu huella, el rostro o el PIN")
      .setAllowedAuthenticators(authenticators)
      .setConfirmationRequired(false)
    if (!usaPin) {
      builder.setNegativeButtonText("Cancelar")
    }
    bioPrompt?.authenticate(builder.build())
  }

  private var speech: SpeechRecognizer? = null
  private var listening = false

  @PluginMethod
  fun startVoz(call: PluginCall) {
    if (getPermissionState("mic") != PermissionState.GRANTED) {
      requestPermissionForAlias("mic", call, "onMicParaVoz")
      return
    }
    arrancarVoz(call)
  }

  @PermissionCallback
  fun onMicParaVoz(call: PluginCall) {
    if (getPermissionState("mic") == PermissionState.GRANTED) {
      arrancarVoz(call)
    } else {
      call.reject("permission denied")
    }
  }

  private fun arrancarVoz(call: PluginCall) {
    val act = activity
    if (act == null) {
      call.reject("no activity")
      return
    }
    act.runOnUiThread {
      if (!SpeechRecognizer.isRecognitionAvailable(context)) {
        call.reject("El teléfono no tiene reconocimiento de voz")
        return@runOnUiThread
      }
      listening = true
      speech?.destroy()
      speech = SpeechRecognizer.createSpeechRecognizer(context).apply {
        setRecognitionListener(object : RecognitionListener {
          override fun onReadyForSpeech(params: Bundle?) {}
          override fun onBeginningOfSpeech() {}
          override fun onRmsChanged(rmsdB: Float) {}
          override fun onBufferReceived(buffer: ByteArray?) {}
          override fun onEndOfSpeech() {}
          override fun onEvent(eventType: Int, params: Bundle?) {}

          override fun onError(error: Int) {
            if (!listening) return
            if (
              error == SpeechRecognizer.ERROR_NO_MATCH
              || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
              || error == SpeechRecognizer.ERROR_CLIENT
            ) {
              listenAgain()
            }
          }

          override fun onResults(results: Bundle) {
            val text = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
            emitVoz(text, true)
            if (listening) listenAgain()
          }

          override fun onPartialResults(partialResults: Bundle) {
            val text = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
            emitVoz(text, false)
          }
        })
      }
      listenAgain()
      call.resolve()
    }
  }

  private fun listenAgain() {
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-AR")
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "es-AR")
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    }
    try {
      speech?.startListening(intent)
    } catch (_: Exception) {
    }
  }

  private fun emitVoz(text: String, final: Boolean) {
    if (text.isBlank()) return
    val data = JSObject()
    data.put("text", text)
    data.put("final", final)
    notifyListeners("voz", data)
  }

  @PluginMethod
  fun stopVoz(call: PluginCall) {
    listening = false
    activity?.runOnUiThread {
      try {
        speech?.stopListening()
      } catch (_: Exception) {
      }
      speech?.destroy()
      speech = null
    }
    call.resolve()
  }

  @PluginMethod
  fun startCerca(call: PluginCall) {
    val token = call.getString("token") ?: ""
    val intent = Intent(context, CercaService::class.java).putExtra(CercaService.EXTRA_TOKEN, token)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
    } else {
      context.startService(intent)
    }
    call.resolve()
  }

  @PluginMethod
  fun stopCerca(call: PluginCall) {
    context.stopService(Intent(context, CercaService::class.java))
    call.resolve()
  }

  @PluginMethod
  fun startScan(call: PluginCall) {
    call.resolve()
  }

  @PluginMethod
  fun stopScan(call: PluginCall) {
    call.resolve()
  }

  @PluginMethod
  fun startNfcListen(call: PluginCall) {
    val adapter = NfcAdapter.getDefaultAdapter(context)
    adapter?.enableReaderMode(
      activity,
      this,
      NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
      null
    )
    call.resolve()
  }

  @PluginMethod
  fun stopNfcListen(call: PluginCall) {
    NfcAdapter.getDefaultAdapter(context)?.disableReaderMode(activity)
    call.resolve()
  }

  @PluginMethod
  fun writeNfc(call: PluginCall) {
    pendingWrite = call.getString("payload")
    writeCall = call
  }

  @PluginMethod
  fun startHce(call: PluginCall) {
    hcePayload = call.getString("payload") ?: ""
    call.resolve()
  }

  @PluginMethod
  fun stopHce(call: PluginCall) {
    hcePayload = ""
    call.resolve()
  }

  private var pendingWrite: String? = null
  private var writeCall: PluginCall? = null

  override fun onTagDiscovered(tag: Tag) {
    val payload = pendingWrite
    if (payload != null) {
      try {
        val ndef = Ndef.get(tag) ?: return
        ndef.connect()
        val record = NdefRecord.createTextRecord("es", payload)
        ndef.writeNdefMessage(NdefMessage(arrayOf(record)))
        ndef.close()
        pendingWrite = null
        writeCall?.resolve()
        writeCall = null
      } catch (e: Exception) {
        writeCall?.reject(e.message)
        writeCall = null
      }
      return
    }
    try {
      val ndef = Ndef.get(tag) ?: return
      ndef.connect()
      val msg = ndef.ndefMessage
      val text = msg?.records?.firstOrNull()?.payload?.let { bytes ->
        if (bytes.size <= 3) String(bytes) else String(bytes, 3, bytes.size - 3, Charsets.UTF_8)
      }
      ndef.close()
      if (!text.isNullOrBlank()) {
        val data = JSObject()
        data.put("payload", text)
        notifyListeners("nfcRead", data)
      }
    } catch (_: Exception) {
    }
  }
}
