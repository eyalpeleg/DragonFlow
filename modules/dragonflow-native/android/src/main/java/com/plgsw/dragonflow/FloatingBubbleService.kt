package com.plgsw.dragonflow

import android.animation.ValueAnimator
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
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

    private var isDragging = false
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var initialX = 0
    private var initialY = 0
    private var screenWidth = 0
    private var screenHeight = 0

    private val bubbleSizeDp = 56
    private val dismissSizeDp = 56
    private val dismissZoneRadiusDp = 60
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
            else -> {
                val count = intent?.getIntExtra("count", 0) ?: 0
                if (bubbleView == null) {
                    createBubbleView(count)
                } else {
                    bubbleView?.setTimerText(null)
                    bubbleView?.updateCount(count)
                }
                updateNotification("Critical tasks active")
            }
        }
        return START_STICKY
    }

    private fun startPomodoroCountdown(endTimeMs: Long, label: String, fallbackCount: Int, fallbackMessage: String) {
        timerHandler.removeCallbacks(timerRunnable)
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

    private fun playPomodoroSound() {
        if (pomodoroSoundType == "Disabled") return
        try {
            val soundResId = R.raw.tada
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
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        if (launchIntent != null) {
            launchIntent.flags =
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            startActivity(launchIntent)
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        updateScreenDimensions()
    }

    override fun onDestroy() {
        timerHandler.removeCallbacks(timerRunnable)
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

        private val gestureDetector = GestureDetector(
            this@FloatingBubbleService,
            object : GestureDetector.SimpleOnGestureListener() {
                override fun onDoubleTap(e: MotionEvent): Boolean {
                    doubleTapped = true
                    removeDismissView()
                    snapToEdge()
                    openApp()
                    return true
                }
            }
        )

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
                    doubleTapped = false
                    createDismissView()
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    if (doubleTapped) return true
                    val params = bubbleParams ?: return true
                    val dx = event.rawX - initialTouchX
                    val dy = event.rawY - initialTouchY
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true
                    params.x = (initialX + dx).toInt()
                    params.y = (initialY + dy).toInt()
                    try { windowManager.updateViewLayout(bubbleView, params) } catch (_: Exception) {}

                    val near = isNearDismissTarget(params.x, params.y)
                    dismissView?.setHighlighted(near)
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    isDragging = false
                    if (doubleTapped) {
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
    }

    private class BubbleView(context: Context, private var count: Int, private val sizePx: Int) :
        View(context) {

        companion object {
            val COLOR_PRIMARY: Int = Color.parseColor("#6200EE")
            val COLOR_ALERT_BORDER: Int = Color.parseColor("#FF9800")
        }

        private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_PRIMARY
            style = Paint.Style.FILL
        }
        private val alertBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = COLOR_ALERT_BORDER
            style = Paint.Style.STROKE
            strokeWidth = 4f
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

        fun setTimerText(text: String?) {
            timerText = text
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

            val t = timerText
            if (t != null) {
                // Timer mode: clean white monospace text for sharp, readable MM:SS
                timerTextPaint.textSize = w * 0.28f
                val textY = h / 2f - (timerTextPaint.descent() + timerTextPaint.ascent()) / 2f
                canvas.drawText(t, w / 2f, textY, timerTextPaint)
            } else if (count > 0) {
                // Draw orange alert border if count > 3
                if (count > 3) {
                    canvas.drawOval(0f, 0f, w, h, alertBorderPaint)
                }
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
