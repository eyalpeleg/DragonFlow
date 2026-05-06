package com.anonymous.DragonFlow

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import android.provider.Settings
import org.json.JSONObject
import java.io.File

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            return
        }

        try {
            val dbPath = File(context.getDatabasePath("RKStorage").path)
            if (!dbPath.exists()) return

            val db = SQLiteDatabase.openDatabase(dbPath.path, null, SQLiteDatabase.OPEN_READONLY)
            val cursor = db.rawQuery(
                "SELECT value FROM catalystLocalStorage WHERE key = ?",
                arrayOf("dragonflow-tasks")
            )

            if (cursor.moveToFirst()) {
                val json = JSONObject(cursor.getString(0))
                val state = json.optJSONObject("state") ?: json

                val showBubble = state.optBoolean("showBubbleInBackground", true)
                if (!showBubble) {
                    cursor.close()
                    db.close()
                    return
                }

                val tasks = state.optJSONArray("tasks")
                var criticalCount = 0
                var firstTitle = ""

                if (tasks != null) {
                    for (i in 0 until tasks.length()) {
                        val task = tasks.getJSONObject(i)
                        val priority = task.optString("priority", "")
                        val status = task.optString("status", "")
                        if (priority == "Critical" && status != "Done") {
                            criticalCount++
                            if (firstTitle.isEmpty()) {
                                firstTitle = task.optString("title", "")
                            }
                        }
                    }
                }

                if (criticalCount > 0) {
                    val serviceIntent = Intent(context, FloatingBubbleService::class.java).apply {
                        putExtra("count", criticalCount)
                        putExtra("message", firstTitle)
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }
                }
            }

            cursor.close()
            db.close()
        } catch (_: Exception) {
        }
    }
}
