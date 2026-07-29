package com.plgsw.dragonflow

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Starts FloatingBubbleService with the correct method for the app's current state.
 *
 * `startForegroundService()` carries a hard contract: the service MUST call
 * `startForeground()` within ~5s or the system kills the app with
 * ForegroundServiceDidNotStartInTimeException. That call is only needed to start a
 * service from the *background*. When the app is in the foreground (or already has a
 * foreground service running), plain `startService()` is permitted and carries no
 * such obligation — so rapid start/stop can't crash. We only escalate to
 * `startForegroundService()` when the process is actually backgrounded.
 */
object ServiceLauncher {
    fun start(context: Context, intent: Intent) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            context.startService(intent)
            return
        }
        val info = ActivityManager.RunningAppProcessInfo()
        ActivityManager.getMyMemoryState(info)
        // <= FOREGROUND_SERVICE covers "UI in foreground" and "we already run a
        // foreground service" — both states where startService() is allowed.
        val canUsePlainStart = info.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND_SERVICE
        try {
            if (canUsePlainStart) context.startService(intent)
            else context.startForegroundService(intent)
        } catch (e: Exception) {
            // If startService() was rejected (state changed to background between the
            // check and the call), fall back to the foreground-service start.
            try { context.startForegroundService(intent) } catch (_: Exception) {}
        }
    }
}
