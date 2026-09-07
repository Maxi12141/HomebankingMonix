package ar.monix.radio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.ParcelUuid
import android.util.Log
import java.util.UUID

class CercaService : Service() {
  companion object {
    const val CHANNEL_ID = "monix_cerca"
    const val EXTRA_TOKEN = "token"
    val SERVICE_UUID: UUID = UUID.fromString("6e6f6e69-7801-4c0c-8000-00000000c0ca")
  }

  private var advertiser: BluetoothLeAdvertiser? = null
  private val advertiseCallback = object : AdvertiseCallback() {
    override fun onStartFailure(errorCode: Int) {
      Log.w("MonixCerca", "advertise failed $errorCode")
    }
  }
  private val scanCallback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      val data = result.scanRecord?.getServiceData(ParcelUuid(SERVICE_UUID)) ?: return
      val token = data.joinToString("") { b -> "%02x".format(b.toInt() and 0xff) }
      MonixRadioPlugin.emitDevice(token, result.rssi)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val token = intent?.getStringExtra(EXTRA_TOKEN) ?: return START_NOT_STICKY
    startForeground(41, buildNotification())
    startBle(token)
    return START_STICKY
  }

  private fun startBle(token: String) {
    val adapter = BluetoothAdapter.getDefaultAdapter() ?: return
    advertiser = adapter.bluetoothLeAdvertiser
    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
      .setConnectable(false)
      .build()
    val bytes = hexToBytes(token)
    val data = AdvertiseData.Builder()
      .addServiceUuid(ParcelUuid(SERVICE_UUID))
      .addServiceData(ParcelUuid(SERVICE_UUID), bytes)
      .setIncludeDeviceName(false)
      .build()
    advertiser?.startAdvertising(settings, data, advertiseCallback)

    val scanSettings = ScanSettings.Builder()
      .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
      .build()
    val filter = ScanFilter.Builder().setServiceUuid(ParcelUuid(SERVICE_UUID)).build()
    adapter.bluetoothLeScanner?.startScan(listOf(filter), scanSettings, scanCallback)
  }

  override fun onDestroy() {
    advertiser?.stopAdvertising(advertiseCallback)
    BluetoothAdapter.getDefaultAdapter()?.bluetoothLeScanner?.stopScan(scanCallback)
    super.onDestroy()
  }

  private fun buildNotification(): Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Monix Cerca", NotificationManager.IMPORTANCE_LOW)
      )
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pi = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setContentTitle("Monix Cerca activo")
      .setContentText("Visible para transferencias al acercar el celular")
      .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
      .setContentIntent(pi)
      .setOngoing(true)
      .build()
  }

  private fun hexToBytes(hex: String): ByteArray {
    val clean = hex.lowercase()
    return ByteArray(clean.length / 2) { i ->
      clean.substring(i * 2, i * 2 + 2).toInt(16).toByte()
    }
  }
}

