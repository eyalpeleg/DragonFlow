package com.plgsw.dragonflow

import android.animation.ValueAnimator
import android.app.AppOpsManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Process
import android.graphics.*
import android.graphics.drawable.BitmapDrawable
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.DisplayMetrics
import android.util.TypedValue
import android.view.*
import android.view.animation.DecelerateInterpolator
import androidx.core.content.ContextCompat

class FloatingBubbleService : Service() {

    private lateinit var windowManager: WindowManager
    private var bubbleView: BubbleView? = null
    private var bubbleParams: WindowManager.LayoutParams? = null
    private var dismissView: DismissTargetView? = null
    private var dismissParams: WindowManager.LayoutParams? = null
    // Pomodoro countdown state
    private var pomodoroEndTimeMs: Long = 0L
    private var pomodoroFallbackCount: Int = 0
    private var pomodoroFallbackMessage: String = ""
    private var pomodoroSoundType: String = "AppSound"
    private var pomodoroVolume: Float = 1.0f
    private var pomodoroCompletionPlayed = false
    private var mediaPlayer: MediaPlayer? = null
    private val timerHandler = Handler(Looper.getMainLooper())
    private val timerRunnable: Runnable = object : Runnable {
        override fun run() {
            val remaining = pomodoroEndTimeMs - System.currentTimeMillis()
            if (remaining <= 0) {
                playPomodoroSound()
                stopPomodoroCountdown(pomodoroFallbackCount, pomodoroFallbackMessage)
                return
            }
            val totalSecs = (remaining / 1000).toInt()
            bubbleView?.setTimerText(String.format("%02d:%02d", totalSecs / 60, totalSecs % 60))
            timerHandler.postDelayed(this, 1000)
        }
    }

    // Parking countdown state. remindAt is JS's source of truth;
    // native only renders the countdown and flips to overdue past it.
    private var parkingRemindAtMs: Long = 0L
    private var parkingFallbackCount: Int = 0
    private var parkingFallbackMessage: String = ""
    private val parkingRunnable: Runnable = object : Runnable {
        override fun run() {
            if (parkingRemindAtMs <= 0L) return
            val remaining = parkingRemindAtMs - System.currentTimeMillis()
            bubbleView?.setParkingText(formatParking(remaining), remaining < 0)
            // 1 Hz while under an hour or overdue (seconds change); else once a minute.
            val delay = if (remaining < 3_600_000L) 1_000L else 60_000L
            timerHandler.postDelayed(this, delay)
        }
    }

    // Parking-app usage-watch state. The poll runs only while monitoring and self-stops
    // after a single debounced background catch (idle→confirm→stop).
    private var parkingMonitoring = false
    private var parkingAppForegroundTs = 0L
    private var parkingLoggedNoAccess = false
    // Most recent onStartCommand id — stopSelf(lastStartId) won't tear down the
    // service when a newer start request is already queued (prevents the
    // ForegroundServiceDidNotStartInTimeException crash under rapid start/stop).
    private var lastStartId = 0
    private val parkingPollRunnable: Runnable = object : Runnable {
        override fun run() {
            pollParkingAppUsage()
            if (parkingMonitoring) timerHandler.postDelayed(this, 1_500L)
        }
    }

    private var isDragging = false
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var initialX = 0
    private var initialY = 0
    private var screenWidth = 0
    private var screenHeight = 0

    private val bubbleSizeDp = 56
    private val dismissSizeDp = 56
    private val dismissZoneRadiusDp = 90
    private val dismissBottomOffsetDp = 80

    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, dp.toFloat(), resources.displayMetrics
        ).toInt()
    }

    private val bubbleSizePx: Int by lazy { dpToPx(bubbleSizeDp) }
    private val dismissSizePx: Int by lazy { dpToPx(dismissSizeDp) }
    private val dismissZoneRadiusPx: Int by lazy { dpToPx(dismissZoneRadiusDp) }
    private val dismissBottomOffsetPx: Int by lazy { dpToPx(dismissBottomOffsetDp) }

    private fun updateScreenDimensions() {
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        windowManager.defaultDisplay.getMetrics(metrics)
        screenWidth = metrics.widthPixels
        screenHeight = metrics.heightPixels

        // Update dismiss view position if it exists
        dismissParams?.let {
            it.gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            it.y = dismissBottomOffsetPx
            try { windowManager.updateViewLayout(dismissView, it) } catch (_: Exception) {}
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

        updateScreenDimensions()

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Every startForegroundService() obligates us to call startForeground()
        // promptly. Do it up-front for EVERY command so a following stopSelf()/
        // stopService() (e.g. stop-parking, stop-watch) can never trigger
        // ForegroundServiceDidNotStartInTimeException.
        lastStartId = startId
        try {
            startForeground(NOTIFICATION_ID, buildNotification())
        } catch (e: Exception) {
            // Some OEMs restrict FGS starts from the background; the obligation is
            // still cleared and we simply won't show the overlay in that case.
        }
        when (intent?.getStringExtra("action")) {
            "startPomodoro" -> {
                val endTimeMs = intent?.getLongExtra("pomodoroEndTimeMs", 0L) ?: 0L
                val label = intent?.getStringExtra("pomodoroLabel") ?: ""
                val fallbackCount = intent?.getIntExtra("fallbackCount", 0) ?: 0
                val fallbackMessage = intent?.getStringExtra("fallbackMessage") ?: ""
                val soundType = intent?.getStringExtra("soundType") ?: "AppSound"
                val volume = intent?.getFloatExtra("volume", 1.0f) ?: 1.0f
                pomodoroSoundType = soundType
                pomodoroVolume = volume
                pomodoroCompletionPlayed = false
                if (bubbleView == null) createBubbleView(0)
                startPomodoroCountdown(endTimeMs, label, fallbackCount, fallbackMessage)
            }
            "stopPomodoro" -> {
                val fallbackCount = intent?.getIntExtra("fallbackCount", 0) ?: 0
                val fallbackMessage = intent?.getStringExtra("fallbackMessage") ?: ""
                stopPomodoroCountdown(fallbackCount, fallbackMessage)
            }
            "startParking" -> {
                val remindAtMs = intent?.getLongExtra("parkingRemindAtMs", 0L) ?: 0L
                val fallbackCount = intent?.getIntExtra("fallbackCount", 0) ?: 0
                val fallbackMessage = intent?.getStringExtra("fallbackMessage") ?: ""
                if (bubbleView == null) createBubbleView(fallbackCount)
                startParkingCountdown(remindAtMs, fallbackCount, fallbackMessage)
            }
            "stopParking" -> {
                val fallbackCount = intent?.getIntExtra("fallbackCount", 0) ?: 0
                val fallbackMessage = intent?.getStringExtra("fallbackMessage") ?: ""
                stopParkingCountdown(fallbackCount, fallbackMessage)
            }
            "startParkingWatch" -> startParkingWatch()
            "stopParkingWatch" -> stopParkingWatch()
            else -> {
                val count = intent?.getIntExtra("count", 0) ?: 0
                if (bubbleView == null) {
                    createBubbleView(count)
                } else {
                    bubbleView?.setTimerText(null)
                    bubbleView?.setParkingText(null, false)
                    bubbleView?.updateCount(count)
                }
                updateNotification("Critical tasks active")
            }
        }
        return START_STICKY
    }

    private fun startPomodoroCountdown(endTimeMs: Long, label: String, fallbackCount: Int, fallbackMessage: String) {
        timerHandler.removeCallbacks(timerRunnable)
        timerHandler.removeCallbacks(parkingRunnable)
        parkingRemindAtMs = 0L
        bubbleView?.setParkingText(null, false)
        pomodoroEndTimeMs = endTimeMs
        pomodoroFallbackCount = fallbackCount
        pomodoroFallbackMessage = fallbackMessage
        updateNotification("Pomodoro: $label timer running")
        timerRunnable.run()
    }

    private fun stopPomodoroCountdown(fallbackCount: Int, fallbackMessage: String) {
        timerHandler.removeCallbacks(timerRunnable)
        pomodoroEndTimeMs = 0L
        bubbleView?.setTimerText(null)
        if (fallbackCount > 0) {
            // Service keeps running — release sound after it finishes
            mediaPlayer?.setOnCompletionListener { it.release(); mediaPlayer = null }
            bubbleView?.updateCount(fallbackCount)
            updateNotification("Critical tasks active")
        } else {
            // Service will stop — wait for sound to finish, then stop
            val mp = mediaPlayer
            if (mp != null) {
                mp.setOnCompletionListener { it.release(); mediaPlayer = null; stopSelf() }
                timerHandler.postDelayed({ mp.release(); mediaPlayer = null; stopSelf() }, 5000)
            } else {
                stopSelf()
            }
        }
    }

    private fun startParkingCountdown(remindAtMs: Long, fallbackCount: Int, fallbackMessage: String) {
        // Already counting down to this exact end — just refresh the fallback and keep
        // ticking (avoids redundant restarts when syncBubble re-pushes on every
        // background transition).
        if (parkingRemindAtMs == remindAtMs && remindAtMs != 0L) {
            parkingFallbackCount = fallbackCount
            parkingFallbackMessage = fallbackMessage
            return
        }
        // Parking supersedes the pomodoro/task bubble while active (AC7a).
        timerHandler.removeCallbacks(timerRunnable)
        timerHandler.removeCallbacks(parkingRunnable)
        parkingRemindAtMs = remindAtMs
        parkingFallbackCount = fallbackCount
        parkingFallbackMessage = fallbackMessage
        bubbleView?.setTimerText(null)
        updateNotification("Parking reminder active")
        android.util.Log.d(PARKING_TAG, "startParking → bubble countdown to remindAt=$remindAtMs (in ${(remindAtMs - System.currentTimeMillis()) / 1000}s)")
        parkingRunnable.run()
    }

    private fun stopParkingCountdown(fallbackCount: Int, fallbackMessage: String) {
        timerHandler.removeCallbacks(parkingRunnable)
        parkingRemindAtMs = 0L
        bubbleView?.setParkingText(null, false)
        // If a pomodoro is still running underneath, hand the bubble back to it
        // rather than to the static task count (precedence: pomodoro > tasks).
        if (pomodoroEndTimeMs > System.currentTimeMillis()) {
            timerRunnable.run()
            return
        }
        if (fallbackCount > 0) {
            bubbleView?.updateCount(fallbackCount)
            updateNotification("Critical tasks active")
        }
        // If nothing else needs the bubble/service, JS follows with hide() (stopService)
        // or the poll keeps the service alive; free it if truly idle.
        maybeStopIfIdle()
    }

    private fun startParkingWatch() {
        parkingAppForegroundTs = 0L
        parkingLoggedNoAccess = false
        if (!parkingMonitoring) {
            parkingMonitoring = true
            timerHandler.removeCallbacks(parkingPollRunnable)
            timerHandler.postDelayed(parkingPollRunnable, 1_500L)
            android.util.Log.d(PARKING_TAG, "startParkingWatch → polling every 1.5s for ${ParkingWatcherModule.PARKING_APP_PACKAGE}")
        } else {
            android.util.Log.d(PARKING_TAG, "startParkingWatch (already monitoring)")
        }
    }

    private fun stopParkingWatch() {
        parkingMonitoring = false
        timerHandler.removeCallbacks(parkingPollRunnable)
        android.util.Log.d(PARKING_TAG, "stopParkingWatch → poll stopped")
        maybeStopIfIdle()
    }

    /**
     * Poll UsageStats for a parking-app foreground→background transition. Reads only
     * which package moved and when; the raw events are never logged or stored
     * (AC16). On a debounced background catch, emit to JS and self-stop.
     */
    private fun pollParkingAppUsage() {
        try {
            val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName
            )
            if (mode != AppOpsManager.MODE_ALLOWED) {
                if (!parkingLoggedNoAccess) {
                    android.util.Log.d(PARKING_TAG, "poll: Usage access NOT granted (mode=$mode) — cannot detect; grant it in Settings")
                    parkingLoggedNoAccess = true
                }
                return
            }
            val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()
            val events = usm.queryEvents(now - 10_000L, now)
            val event = UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.packageName != ParkingWatcherModule.PARKING_APP_PACKAGE) continue
                when (event.eventType) {
                    UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                        parkingAppForegroundTs = event.timeStamp
                        android.util.Log.d(PARKING_TAG, "poll: parking-app FOREGROUND seen (ts=${event.timeStamp})")
                    }
                    UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                        val gap = if (parkingAppForegroundTs > 0L) event.timeStamp - parkingAppForegroundTs else -1L
                        android.util.Log.d(PARKING_TAG, "poll: parking-app BACKGROUND seen (fgSeen=${parkingAppForegroundTs > 0L}, gap=${gap}ms, debounce=${ParkingWatcherModule.DEBOUNCE_MS}ms)")
                        if (parkingAppForegroundTs > 0L && gap >= ParkingWatcherModule.DEBOUNCE_MS) {
                            parkingAppForegroundTs = 0L
                            android.util.Log.d(PARKING_TAG, "poll: debounce OK → emit parkingAppBackgrounded + self-stop")
                            ParkingWatcherModule.sendParkingBackgroundedEvent()
                            stopParkingWatch() // self-stop; JS re-arms after the prompt is resolved
                            return
                        } else {
                            android.util.Log.d(PARKING_TAG, "poll: background ignored (foreground <${ParkingWatcherModule.DEBOUNCE_MS}ms or not seen in window)")
                        }
                    }
                }
            }
        } catch (e: Exception) {
            // Never crash the poll — locked-device null returns / OEM quirks are expected.
            android.util.Log.d(PARKING_TAG, "poll: exception (expected on locked device): ${e.message}")
        }
    }

    private fun maybeStopIfIdle() {
        if (bubbleView == null && pomodoroEndTimeMs <= 0L && parkingRemindAtMs <= 0L && !parkingMonitoring) {
            // stopSelf(startId): no-op if a newer start request has already arrived,
            // so we never orphan a pending startForegroundService() obligation.
            stopSelf(lastStartId)
        }
    }

    private fun formatParking(remainingMs: Long): String {
        if (remainingMs < 0) {
            val overMin = -remainingMs / 60_000L
            return if (overMin >= 60) "+${overMin / 60}h${String.format("%02d", overMin % 60)}m" else "+${overMin}m"
        }
        val totalSec = remainingMs / 1000L
        val h = totalSec / 3600L
        val m = (totalSec % 3600L) / 60L
        val s = totalSec % 60L
        return if (totalSec >= 3600L) "$h:${String.format("%02d", m)}"
        else String.format("%02d:%02d", m, s)
    }

    private fun playPomodoroSound() {
        if (pomodoroSoundType == "Disabled") return
        try {
            val soundResId = R.raw.bell
            mediaPlayer?.release()
            mediaPlayer = MediaPlayer.create(this, soundResId)
            mediaPlayer?.setVolume(pomodoroVolume, pomodoroVolume)
            mediaPlayer?.start()
        } catch (e: Exception) {
            android.util.Log.e("FloatingBubbleService", "Error playing sound: ${e.message}")
        }
    }

    private fun updateNotification(contentText: String) {
        val notification = buildNotification(contentText)
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun createBubbleView(count: Int) {
        bubbleView = BubbleView(this, count, bubbleSizePx)

        val layoutFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE

        bubbleParams = WindowManager.LayoutParams(
            bubbleSizePx, bubbleSizePx,
            layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 0
            y = screenHeight / 3
        }

        bubbleView?.setOnTouchListener(BubbleTouchListener())
        try {
            windowManager.addView(bubbleView, bubbleParams)
        } catch (e: Exception) {
            bubbleView = null
            stopSelf()
        }
    }

    private fun createDismissView() {
        if (dismissView != null) return

        dismissView = DismissTargetView(this, dismissSizePx)

        val layoutFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE

        dismissParams = WindowManager.LayoutParams(
            dismissSizePx, dismissSizePx,
            layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            y = dismissBottomOffsetPx
        }

        windowManager.addView(dismissView, dismissParams)
    }

    private fun removeDismissView() {
        dismissView?.let {
            try { windowManager.removeView(it) } catch (_: Exception) {}
        }
        dismissView = null
        dismissParams = null
    }

    private fun isNearDismissTarget(bubbleX: Int, bubbleY: Int): Boolean {
        val bubbleCenterX = bubbleX + bubbleSizePx / 2
        val bubbleCenterY = bubbleY + bubbleSizePx / 2

        val dismissCenterX = screenWidth / 2
        val dismissCenterY = screenHeight - dismissBottomOffsetPx - dismissSizePx / 2

        val dx = bubbleCenterX - dismissCenterX
        val dy = bubbleCenterY - dismissCenterY
        val distanceSq = (dx * dx + dy * dy).toLong()

        return distanceSq < dismissZoneRadiusPx.toLong() * dismissZoneRadiusPx
    }

    private fun snapToEdge() {
        val params = bubbleParams ?: return
        val bubbleCenterX = params.x + bubbleSizePx / 2
        val targetX = if (bubbleCenterX < screenWidth / 2) 0 else screenWidth - bubbleSizePx

        val animator = ValueAnimator.ofInt(params.x, targetX)
        animator.duration = 250
        animator.interpolator = DecelerateInterpolator()
        animator.addUpdateListener { animation ->
            params.x = animation.animatedValue as Int
            try { windowManager.updateViewLayout(bubbleView, params) } catch (_: Exception) {}
        }
        animator.start()
    }

    private fun dismissBubble() {
        FloatingBubbleModule.sendDismissEvent()
        stopSelf()
    }

    private fun openApp() {
        // While a parking session owns the bubble, a tap opens the parking sheet
        // (extend / done); otherwise it enters Focus mode as before.
        val action = if (parkingRemindAtMs > 0L) "parking" else "focus"
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        if (launchIntent != null) {
            launchIntent.flags =
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            launchIntent.putExtra("dragonflow_action", action)
            startActivity(launchIntent)
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        updateScreenDimensions()
    }

    override fun onDestroy() {
        timerHandler.removeCallbacksAndMessages(null)
        mediaPlayer?.release()
        mediaPlayer = null
        bubbleView?.let {
            try { windowManager.removeView(it) } catch (_: Exception) {}
        }
        bubbleView = null
        removeDismissView()
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Floating Bubble",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps the floating bubble active"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(contentText: String = "Critical tasks active"): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            Notification.Builder(this, CHANNEL_ID)
        else
            @Suppress("DEPRECATION")
            Notification.Builder(this)

        return builder
            .setContentTitle("DragonFlow")
            .setContentText(contentText)
            .setSmallIcon(R.drawable.bubble_icon)
            .build()
    }

    private inner class BubbleTouchListener : View.OnTouchListener {
        private var moved = false
        private var doubleTapped = false
        private var pendingShowDismiss: Runnable? = null

        // Delay showing the dismiss "X" so a double-tap (which opens the app)
        // doesn't briefly flash it between taps. ~200ms is just under the
        // platform double-tap timeout (~300ms), enough that a real drag still
        // sees the target appear quickly. A drag-threshold cross in
        // ACTION_MOVE shows the X immediately regardless.
        private val showDismissDelayMs = 200L

        private val gestureDetector = GestureDetector(
            this@FloatingBubbleService,
            object : GestureDetector.SimpleOnGestureListener() {
                override fun onDoubleTap(e: MotionEvent): Boolean {
                    doubleTapped = true
                    cancelPendingDismissShow()
                    removeDismissView()
                    snapToEdge()
                    openApp()
                    return true
                }
            }
        )

        private fun scheduleDismissShow() {
            cancelPendingDismissShow()
            val r = Runnable { createDismissView() }
            pendingShowDismiss = r
            timerHandler.postDelayed(r, showDismissDelayMs)
        }

        private fun cancelPendingDismissShow() {
            pendingShowDismiss?.let { timerHandler.removeCallbacks(it) }
            pendingShowDismiss = null
        }

        override fun onTouch(v: View, event: MotionEvent): Boolean {
            gestureDetector.onTouchEvent(event)

            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    initialX = bubbleParams?.x ?: 0
                    initialY = bubbleParams?.y ?: 0
                    isDragging = true
                    moved = false
                    // gestureDetector.onTouchEvent above may have already fired
                    // onDoubleTap and set doubleTapped=true. If so, the app is
                    // opening — don't arm a new dismiss-show that could outlive
                    // the service and orphan the X view. Let ACTION_UP clear
                    // the flag.
                    if (!doubleTapped) {
                        scheduleDismissShow()
                    }
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    if (doubleTapped) return true
                    val params = bubbleParams ?: return true
                    val dx = event.rawX - initialTouchX
                    val dy = event.rawY - initialTouchY
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                        if (!moved) {
                            cancelPendingDismissShow()
                            createDismissView()
                        }
                        moved = true
                    }
                    params.x = (initialX + dx).toInt()
                    params.y = (initialY + dy).toInt()
                    try { windowManager.updateViewLayout(bubbleView, params) } catch (_: Exception) {}

                    val near = isNearDismissTarget(params.x, params.y)
                    dismissView?.setHighlighted(near)
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    isDragging = false
                    cancelPendingDismissShow()
                    if (doubleTapped) {
                        removeDismissView()
                        doubleTapped = false
                        return true
                    }
                    val params = bubbleParams ?: return true

                    if (isNearDismissTarget(params.x, params.y)) {
                        removeDismissView()
                        dismissBubble()
                    } else {
                        removeDismissView()
                        snapToEdge()
                    }
                    return true
                }
            }
            return false
        }
    }

    companion object {
        private const val CHANNEL_ID = "floating_bubble_channel"
        private const val NOTIFICATION_ID = 9999
        const val PARKING_TAG = "ParkingWatcher"
    }

    private class BubbleView(context: Context, private var count: Int, private val sizePx: Int) :
        View(context) {

        companion object {
            val COLOR_PRIMARY: Int = Color.parseColor("#76578c")
            val COLOR_NORMAL_BORDER: Int = Color.parseColor("#D4AF37")
            val COLOR_ALERT_BORDER: Int = Color.parseColor("#E53935")
        }

        private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_PRIMARY
            style = Paint.Style.FILL
        }
        private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_NORMAL_BORDER
            style = Paint.Style.STROKE
            strokeWidth = 6f
        }
        private val countTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }
        private val timerTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textAlign = Paint.Align.CENTER
            typeface = Typeface.MONOSPACE
        }


        private var timerText: String? = null
        private var parkingText: String? = null
        private var parkingOverdue = false

        fun setTimerText(text: String?) {
            timerText = text
            invalidate()
        }

        fun setParkingText(text: String?, overdue: Boolean) {
            parkingText = text
            parkingOverdue = overdue
            invalidate()
        }

        fun updateCount(newCount: Int) {
            count = newCount
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val w = width.toFloat()
            val h = height.toFloat()

            // Draw purple ellipse background
            canvas.drawOval(0f, 0f, w, h, backgroundPaint)

            // Always draw a border — alert color when count is high or parking is
            // overdue, normal otherwise. Inset by half the stroke so the outer edge
            // of the stroke isn't clipped by the view bounds.
            borderPaint.color = if (count > 3 || parkingOverdue) COLOR_ALERT_BORDER else COLOR_NORMAL_BORDER
            val inset = borderPaint.strokeWidth / 2f
            canvas.drawOval(inset, inset, w - inset, h - inset, borderPaint)

            val pt = parkingText
            val t = timerText
            if (pt != null) {
                // Parking mode: monospace countdown ("h:mm"/"mm:ss") or overdue ("+Xm").
                // Overdue is signalled by the red border AND the leading "+" — not colour alone.
                timerTextPaint.textSize = w * (if (pt.length > 4) 0.22f else 0.28f)
                val textY = h / 2f - (timerTextPaint.descent() + timerTextPaint.ascent()) / 2f
                canvas.drawText(pt, w / 2f, textY, timerTextPaint)
            } else if (t != null) {
                // Timer mode: clean white monospace text for sharp, readable MM:SS
                timerTextPaint.textSize = w * 0.28f
                val textY = h / 2f - (timerTextPaint.descent() + timerTextPaint.ascent()) / 2f
                canvas.drawText(t, w / 2f, textY, timerTextPaint)
            } else if (count > 0) {
                val text = if (count > 9) "9+" else count.toString()
                countTextPaint.textSize = w * 0.35f
                val textY = h / 2f - (countTextPaint.descent() + countTextPaint.ascent()) / 2f
                canvas.drawText(text, w / 2f, textY, countTextPaint)
            }
        }
    }

    private class DismissTargetView(context: Context, private val sizePx: Int) : View(context) {
        private var highlighted = false
        private val circlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.DKGRAY
            style = Paint.Style.FILL
        }
        private val xPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            strokeWidth = 4f
            strokeCap = Paint.Cap.ROUND
            style = Paint.Style.STROKE
        }

        fun setHighlighted(value: Boolean) {
            if (highlighted != value) {
                highlighted = value
                circlePaint.color = if (highlighted) Color.RED else Color.DKGRAY
                invalidate()
            }
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val cx = width / 2f
            val cy = height / 2f
            val radius = Math.min(width, height) / 2f

            canvas.drawCircle(cx, cy, radius, circlePaint)

            val offset = radius * 0.35f
            canvas.drawLine(cx - offset, cy - offset, cx + offset, cy + offset, xPaint)
            canvas.drawLine(cx + offset, cy - offset, cx - offset, cy + offset, xPaint)
        }
    }
}
