package com.plgsw.dragonflow

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Detects that the Pango app was used and moved to the background, by asking the
 * FloatingBubbleService to poll UsageStats. The module is deliberately "dumb": it
 * starts/stops the service's poll loop, checks/opens the "Usage access" special
 * permission, launches Pango, and bridges a single "pangoBackgrounded" event to
 * JS. It never reads or stores what happens inside Pango or any other app — only
 * that Pango's package moved to the background.
 *
 * See docs/design/features/pango-reminder/design.md.
 */
class PangoWatcherModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PangoWatcher"

    init {
        Companion.reactContext = reactContext
    }

    @ReactMethod
    fun startMonitoring() {
        sendServiceAction("startPangoWatch")
    }

    @ReactMethod
    fun stopMonitoring() {
        sendServiceAction("stopPangoWatch")
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
            promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
        } catch (e: Exception) {
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

    /** AC6 — launch Pango by fixed package; resolve false if it isn't installed. */
    @ReactMethod
    fun openPango(promise: Promise) {
        try {
            val launch = reactApplicationContext.packageManager.getLaunchIntentForPackage(PANGO_PACKAGE)
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
        if (eventName == "pangoBackgrounded" && pendingPangoBackground) {
            pendingPangoBackground = false
            sendPangoBackgroundedEvent()
        }
    }

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun sendServiceAction(action: String) {
        val context = reactApplicationContext
        val intent = Intent(context, FloatingBubbleService::class.java).apply {
            putExtra("action", action)
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (e: Exception) {
            // ignore — can't start the service (e.g. background start restriction)
        }
    }

    companion object {
        const val PANGO_PACKAGE = "com.unicell.pangoandroid"
        const val DEBOUNCE_MS = 20_000L

        var reactContext: ReactApplicationContext? = null

        @Volatile
        var pendingPangoBackground: Boolean = false

        /**
         * Called from the FloatingBubbleService poll loop when a debounced Pango
         * background transition is observed. Buffers if JS hasn't subscribed yet.
         */
        fun sendPangoBackgroundedEvent() {
            val emitter = reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            if (emitter == null) {
                pendingPangoBackground = true
                return
            }
            emitter.emit("pangoBackgrounded", null)
        }
    }
}
