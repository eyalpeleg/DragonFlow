package com.plgsw.dragonflow

import android.animation.ValueAnimator
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.graphics.drawable.BitmapDrawable
import android.os.Build
import android.os.IBinder
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

    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, dp.toFloat(), resources.displayMetrics
        ).toInt()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        windowManager.defaultDisplay.getMetrics(metrics)
        screenWidth = metrics.widthPixels
        screenHeight = metrics.heightPixels

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val count = intent?.getIntExtra("count", 0) ?: 0
        val message = intent?.getStringExtra("message") ?: ""

        if (bubbleView == null) {
            createBubbleView(count)
        } else {
            bubbleView?.updateCount(count)
        }

        return START_STICKY
    }

    private fun createBubbleView(count: Int) {
        val sizePx = dpToPx(bubbleSizeDp)

        bubbleView = BubbleView(this, count, sizePx)

        val layoutFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE

        bubbleParams = WindowManager.LayoutParams(
            sizePx, sizePx,
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

        val sizePx = dpToPx(dismissSizeDp)
        dismissView = DismissTargetView(this, sizePx)

        val layoutFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE

        dismissParams = WindowManager.LayoutParams(
            sizePx, sizePx,
            layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            y = dpToPx(80)
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
        val bubbleSizePx = dpToPx(bubbleSizeDp)
        val bubbleCenterX = bubbleX + bubbleSizePx / 2
        val bubbleCenterY = bubbleY + bubbleSizePx / 2

        val dismissCenterX = screenWidth / 2
        val dismissCenterY = screenHeight - dpToPx(80) - dpToPx(dismissSizeDp) / 2

        val dx = bubbleCenterX - dismissCenterX
        val dy = bubbleCenterY - dismissCenterY
        val distance = Math.sqrt((dx * dx + dy * dy).toDouble())

        return distance < dpToPx(dismissZoneRadiusDp)
    }

    private fun snapToEdge() {
        val params = bubbleParams ?: return
        val bubbleSizePx = dpToPx(bubbleSizeDp)
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

    override fun onDestroy() {
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

    private fun buildNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            Notification.Builder(this, CHANNEL_ID)
        else
            @Suppress("DEPRECATION")
            Notification.Builder(this)

        return builder
            .setContentTitle("DragonFlow")
            .setContentText("Critical tasks active")
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

        private val iconBitmap: Bitmap?
        private val iconRect = RectF()
        private val countStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
            style = Paint.Style.STROKE
            strokeWidth = 6f
        }
        private val countTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (count <= 3) Color.parseColor("#346eeb") else Color.RED
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }

        init {
            val drawable = ContextCompat.getDrawable(context, R.drawable.bubble_icon)
            iconBitmap = if (drawable is BitmapDrawable) {
                drawable.bitmap
            } else if (drawable != null) {
                val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bmp)
                drawable.setBounds(0, 0, sizePx, sizePx)
                drawable.draw(canvas)
                bmp
            } else null
        }

        fun updateCount(newCount: Int) {
            count = newCount
            countTextPaint.color = if (count <= 3) Color.parseColor("#346eeb") else Color.RED
            invalidate()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val w = width.toFloat()
            val h = height.toFloat()

            iconBitmap?.let {
                iconRect.set(0f, 0f, w, h)
                canvas.drawBitmap(it, null, iconRect, null)
            }

            if (count > 0) {
                val text = if (count > 9) "9+" else count.toString()
                countTextPaint.textSize = w * 0.35f
                countStrokePaint.textSize = w * 0.35f
                val textY = h / 2f - (countTextPaint.descent() + countTextPaint.ascent()) / 2f
                canvas.drawText(text, w / 2f, textY, countStrokePaint)
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
