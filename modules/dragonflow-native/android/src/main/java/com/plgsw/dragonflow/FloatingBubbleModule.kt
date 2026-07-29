package com.plgsw.dragonflow

import android.app.Activity
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class FloatingBubbleModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    ActivityEventListener,
    LifecycleEventListener {

    override fun getName(): String = "FloatingBubble"

    init {
        Companion.reactContext = reactContext
        reactContext.addActivityEventListener(this)
        reactContext.addLifecycleEventListener(this)
    }

    // Warm start: bubble double-tap brings a running app forward via a new intent.
    override fun onNewIntent(intent: Intent) {
        consumeFocusAction(intent)
    }

    // ActivityEventListener requires this — we don't use it.
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {}

    // Cold start: after the launch intent created MainActivity, the first resume
    // exposes that intent on currentActivity.intent. Peek once and consume.
    override fun onHostResume() {
        consumeFocusAction(reactApplicationContext.currentActivity?.intent)
    }

    override fun onHostPause() {}
    override fun onHostDestroy() {}

    private fun consumeFocusAction(intent: Intent?) {
        when (intent?.getStringExtra("dragonflow_action")) {
            "focus" -> {
                // One-shot: clear the extra so subsequent foreground resumes don't re-trigger.
                intent.removeExtra("dragonflow_action")
                pendingOpenFocus = true
                sendOpenFocusEvent()
            }
            "parking" -> {
                intent.removeExtra("dragonflow_action")
                pendingParkingTap = true
                sendParkingTapEvent()
            }
        }
    }

    @ReactMethod
    fun show(count: Int, message: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            !Settings.canDrawOverlays(reactApplicationContext)) {
            return
        }
        val context = reactApplicationContext
        val intent = Intent(context, FloatingBubbleService::class.java).apply {
            putExtra("count", count)
            putExtra("message", message)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    @ReactMethod
    fun hide() {
        val context = reactApplicationContext
        context.stopService(Intent(context, FloatingBubbleService::class.java))
    }

    @ReactMethod
    fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${reactApplicationContext.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun scheduleSound(alarmId: String, triggerAtMs: Double, soundType: String, soundFile: String, volume: Float) {
        val context = reactApplicationContext
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, SoundAlarmReceiver::class.java).apply {
            putExtra("soundType", soundType)
            putExtra("soundFile", soundFile)
            putExtra("volume", volume)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            alarmId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val now = System.currentTimeMillis()
        val delayMs = triggerAtMs.toLong() - now
        val formatter = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US)
        val nowStr = formatter.format(java.util.Date(now))
        val triggerStr = formatter.format(java.util.Date(triggerAtMs.toLong()))
        android.util.Log.d("FloatingBubbleModule", "[$nowStr] [scheduleSound] $alarmId: trigger=$triggerStr, delay=${delayMs}ms, soundFile=$soundFile")

        // Use exact alarm if permission is granted, otherwise fall back to inexact
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            if (context.checkSelfPermission(android.Manifest.permission.SCHEDULE_EXACT_ALARM) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs.toLong(), pendingIntent)
            } else {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs.toLong(), pendingIntent)
            }
        } else {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs.toLong(), pendingIntent)
        }
    }

    @ReactMethod
    fun cancelSound(alarmId: String) {
        val context = reactApplicationContext
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, SoundAlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            alarmId.hashCode(),
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        ) ?: return
        alarmManager.cancel(pendingIntent)
        pendingIntent.cancel()
    }

    @ReactMethod
    fun startPomodoroTimer(endTimeMs: Double, label: String, fallbackCount: Int, fallbackMessage: String, soundType: String, volume: Float) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            !Settings.canDrawOverlays(reactApplicationContext)) {
            return
        }
        val context = reactApplicationContext
        val intent = Intent(context, FloatingBubbleService::class.java).apply {
            putExtra("action", "startPomodoro")
            putExtra("pomodoroEndTimeMs", endTimeMs.toLong())
            putExtra("pomodoroLabel", label)
            putExtra("fallbackCount", fallbackCount)
            putExtra("fallbackMessage", fallbackMessage)
            putExtra("soundType", soundType)
            putExtra("volume", volume)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    @ReactMethod
    fun stopPomodoroTimer(fallbackCount: Int, fallbackMessage: String) {
        val context = reactApplicationContext
        val intent = Intent(context, FloatingBubbleService::class.java).apply {
            putExtra("action", "stopPomodoro")
            putExtra("fallbackCount", fallbackCount)
            putExtra("fallbackMessage", fallbackMessage)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    @ReactMethod
    fun startParkingTimer(remindAtMs: Double, fallbackCount: Int, fallbackMessage: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            !Settings.canDrawOverlays(reactApplicationContext)) {
            return
        }
        val context = reactApplicationContext
        val intent = Intent(context, FloatingBubbleService::class.java).apply {
            putExtra("action", "startParking")
            putExtra("parkingRemindAtMs", remindAtMs.toLong())
            putExtra("fallbackCount", fallbackCount)
            putExtra("fallbackMessage", fallbackMessage)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    @ReactMethod
    fun stopParkingTimer(fallbackCount: Int, fallbackMessage: String) {
        val context = reactApplicationContext
        val intent = Intent(context, FloatingBubbleService::class.java).apply {
            putExtra("action", "stopParking")
            putExtra("fallbackCount", fallbackCount)
            putExtra("fallbackMessage", fallbackMessage)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // On cold start, the open-focus / parking-tap intent may arrive before JS
        // subscribes. When JS finally subscribes, flush any pending signal.
        if (eventName == "floatingBubbleOpenFocus" && pendingOpenFocus) {
            pendingOpenFocus = false
            sendOpenFocusEvent()
        }
        if (eventName == "floatingBubbleParkingTap" && pendingParkingTap) {
            pendingParkingTap = false
            sendParkingTapEvent()
        }
    }

    @ReactMethod
    fun removeListeners(count: Int) {}

    companion object {
        var reactContext: ReactApplicationContext? = null

        @Volatile
        var pendingOpenFocus: Boolean = false

        @Volatile
        var pendingParkingTap: Boolean = false

        fun sendDismissEvent() {
            reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("floatingBubbleDismissed", null)
        }

        fun sendOpenFocusEvent() {
            reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("floatingBubbleOpenFocus", null)
        }

        fun sendParkingTapEvent() {
            reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("floatingBubbleParkingTap", null)
        }
    }
}
