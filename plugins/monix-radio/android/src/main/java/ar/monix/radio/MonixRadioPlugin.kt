package ar.monix.radio

import android.Manifest
import android.content.Intent
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission

@CapacitorPlugin(
  name = "MonixRadio",
  permissions = [
    Permission(strings = [Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.NFC, Manifest.permission.POST_NOTIFICATIONS], alias = "radio")
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
