package com.plgsw.dragonflow

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Receives text/plain ACTION_SEND shares routed to MainActivity by the manifest
 * intent-filter (added in scripts/patch-native-config.js) and hands the raw text to JS.
 *
 * Mirrors FloatingBubbleModule's intent-capture pattern:
 *   - cold start: onHostResume peeks currentActivity.intent → stored as `pending`
 *   - warm start: onNewIntent → emitted as "shareTextReceived"
 * A one-shot removeExtra() prevents the same share being delivered twice.
 *
 * The module is deliberately "dumb": it shuttles raw { text, subject } strings and
 * never parses or logs their content. Parsing lives in src/utils/shareText.ts.
 *
 * See docs/design/features/share-text-target/design.md §2.
 */
class ShareIntentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    ActivityEventListener,
    LifecycleEventListener {

    override fun getName(): String = "ShareIntent"

    init {
        Companion.reactContext = reactContext
        reactContext.addActivityEventListener(this)
        reactContext.addLifecycleEventListener(this)
    }

    // Warm start: a share while the app is already running arrives here.
    override fun onNewIntent(intent: Intent) {
        if (consumeSendIntent(intent)) {
            sendShareTextEvent()
        }
    }

    // ActivityEventListener requires this — we don't use it.
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {}

    // Cold start: the launch intent is exposed on currentActivity.intent at first resume.
    override fun onHostResume() {
        consumeSendIntent(reactApplicationContext.currentActivity?.intent)
    }

    override fun onHostPause() {}
    override fun onHostDestroy() {}

    /**
     * If [intent] is a text/plain ACTION_SEND, capture EXTRA_TEXT (+ EXTRA_SUBJECT)
     * into pending state and clear the extras (one-shot). Returns true if captured.
     * Never throws — a malformed intent is ignored, never a crash.
     */
    private fun consumeSendIntent(intent: Intent?): Boolean {
        try {
            if (intent?.action != Intent.ACTION_SEND) return false
            if (intent.type?.startsWith("text/") != true) return false
            val text = intent.getStringExtra(Intent.EXTRA_TEXT)
            if (text.isNullOrBlank()) return false
            val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)

            // One-shot: clear so a later resume can't re-deliver the same share.
            intent.removeExtra(Intent.EXTRA_TEXT)
            intent.removeExtra(Intent.EXTRA_SUBJECT)

            pendingText = text
            pendingSubject = subject
            return true
        } catch (e: Exception) {
            return false
        }
    }

    /** Cold-start channel: JS pulls the pending share once on mount, then it's cleared. */
    @ReactMethod
    fun getInitialShareText(promise: Promise) {
        try {
            val text = pendingText
            if (text.isNullOrBlank()) {
                promise.resolve(null)
                return
            }
            val map = buildShareMap(text, pendingSubject)
            pendingText = null
            pendingSubject = null
            promise.resolve(map)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    // NativeEventEmitter bookkeeping (no-ops; required to silence RN warnings).
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    companion object {
        var reactContext: ReactApplicationContext? = null

        @Volatile
        var pendingText: String? = null

        @Volatile
        var pendingSubject: String? = null

        private fun buildShareMap(text: String, subject: String?): WritableMap {
            val map = Arguments.createMap()
            map.putString("text", text)
            if (subject != null) map.putString("subject", subject)
            return map
        }

        /** Emit the pending share to JS (warm-start channel), then clear it. */
        fun sendShareTextEvent() {
            val text = pendingText ?: return
            val map = buildShareMap(text, pendingSubject)
            pendingText = null
            pendingSubject = null
            reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("shareTextReceived", map)
        }
    }
}
