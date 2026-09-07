package ar.monix.radio

import android.nfc.cardemulation.HostApduService
import android.os.Bundle

class MonixHceService : HostApduService() {
  override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
    val payload = MonixRadioPlugin.hcePayload.toByteArray(Charsets.UTF_8)
    val ok = byteArrayOf(0x90.toByte(), 0x00)
    return payload + ok
  }

  override fun onDeactivated(reason: Int) {}
}
