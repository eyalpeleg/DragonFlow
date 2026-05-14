package com.plgsw.dragonflow

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer

class SoundAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val formatter = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US)
        val now = formatter.format(java.util.Date(System.currentTimeMillis()))
        android.util.Log.d("SoundAlarmReceiver", "[$now] [onReceive] alarm fired")

        if (intent.getStringExtra("soundType") != "AppSound") return
        val soundFile = intent.getStringExtra("soundFile") ?: "ding"
        val volume = intent.getFloatExtra("volume", 1.0f).coerceIn(0f, 1f)
        android.util.Log.d("SoundAlarmReceiver", "[$now] [onReceive] playing $soundFile at volume=$volume")
        playAppSound(context, soundFile, volume)
    }

    private fun playAppSound(context: Context, soundFile: String, volume: Float) {
        val formatter = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US)
        val now = formatter.format(java.util.Date(System.currentTimeMillis()))
        val resId = if (soundFile == "bell") R.raw.bell else R.raw.ding
        try {
            val player = MediaPlayer.create(context, resId) ?: return
            android.util.Log.d("SoundAlarmReceiver", "[$now] [playAppSound] MediaPlayer created, starting playback")
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            player.setVolume(volume, volume)
            player.setOnCompletionListener { it.release() }
            player.start()
            android.util.Log.d("SoundAlarmReceiver", "[$now] [playAppSound] playback started")
        } catch (e: Exception) {
            android.util.Log.e("SoundAlarmReceiver", "[$now] [playAppSound] error: ${e.message}")
        }
    }
}
