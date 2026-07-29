package com.plgsw.dragonflow

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Detects that the watched parking app was used and moved to the background, by
 * asking the FloatingBubbleService to poll UsageStats. The module is deliberately
 * "dumb": it starts/stops the service's poll loop, checks/opens the "Usage access"
 * special permission, launches the parking app, and bridges a single
 * "parkingAppBackgrounded" event to JS. It never reads or stores what happens
 * inside the parking app or any other app — only that its package moved to the
 * background.
 *
 * See docs/design/features/parking-reminder/design.md.
 */
class ParkingWatcherModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ParkingWatcher"

    init {
        Companion.reactContext = reactContext
    }

    @ReactMethod
    fun startMonitoring() {
        sendServiceAction("startParkingWatch")
    }

    @ReactMethod
    fun stopMonitoring() {
        sendServiceAction("stopParkingWatch")
    }

    /** AC15 — the Usage-access grant is a revocable app-op; JS re-checks it. */
    @ReactMethod
    fun hasUsageAccess(promise: Promise) {
        try {
            val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactApplicationContext.packageName
            )
            val granted = mode == AppOpsManager.MODE_ALLOWED
            android.util.Log.d(TAG, "hasUsageAccess → $granted (mode=$mode)")
            promise.resolve(granted)
        } catch (e: Exception) {
            android.util.Log.d(TAG, "hasUsageAccess → false (exception: ${e.message})")
            promise.resolve(false)
        }
    }

    /** AC14 — deep-link to Settings → Usage access so the user can grant it. */
    @ReactMethod
    fun requestUsageAccess() {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            // ignore — no Settings activity to handle it
        }
    }

    /** AC6 — launch the parking app by fixed package; resolve false if not installed. */
    @ReactMethod
    fun openParkingApp(promise: Promise) {
        try {
            val launch = reactApplicationContext.packageManager.getLaunchIntentForPackage(PARKING_APP_PACKAGE)
            if (launch == null) {
                promise.resolve(false)
                return
            }
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(launch)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Cold-start safety: if a background event was observed before JS
        // subscribed, flush it now.
        if (eventName == "parkingAppBackgrounded" && pendingParkingBackground) {
            pendingParkingBackground = false
            sendParkingBackgroundedEvent()
        }
    }

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun sendServiceAction(action: String) {
        val context = reactApplicationContext
        val intent = Intent(context, FloatingBubbleService::class.java).apply {
            putExtra("action", action)
        }
        ServiceLauncher.start(context, intent)
    }

    companion object {
        const val TAG = "ParkingWatcher"
        // The one intentional vendor reference: the package id of the parking app
        // we watch. Becomes a list when more vendors (CelloPark, …) are added.
        const val PARKING_APP_PACKAGE = "com.unicell.pangoandroid"
        const val DEBOUNCE_MS = 10_000L // production: min foreground time before a background counts

        var reactContext: ReactApplicationContext? = null

        @Volatile
        var pendingParkingBackground: Boolean = false

        /**
         * Called from the FloatingBubbleService poll loop when a debounced parking-app
         * background transition is observed. Buffers if JS hasn't subscribed yet.
         */
        fun sendParkingBackgroundedEvent() {
            val emitter = reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            if (emitter == null) {
                android.util.Log.d(TAG, "sendParkingBackgroundedEvent: JS not ready → buffered")
                pendingParkingBackground = true
                return
            }
            android.util.Log.d(TAG, "sendParkingBackgroundedEvent: emitting to JS")
            emitter.emit("parkingAppBackgrounded", null)
        }
    }
}
