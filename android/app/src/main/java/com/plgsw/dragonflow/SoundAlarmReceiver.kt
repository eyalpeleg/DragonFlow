package com.plgsw.dragonflow

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer

class SoundAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.getStringExtra("soundType") != "AppSound") return
        val soundFile = intent.getStringExtra("soundFile") ?: "ding"
        val volume = intent.getFloatExtra("volume", 1.0f).coerceIn(0f, 1f)
        playAppSound(context, soundFile, volume)
    }

    private fun playAppSound(context: Context, soundFile: String, volume: Float) {
        val resId = if (soundFile == "tada") R.raw.tada else R.raw.ding
        try {
            val player = MediaPlayer.create(context, resId) ?: return
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            player.setVolume(volume, volume)
            player.setOnCompletionListener { it.release() }
            player.start()
        } catch (_: Exception) {}
    }
}
