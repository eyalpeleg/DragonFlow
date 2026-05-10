package com.plgsw.dragonflow

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
                var score = 0
                val today = java.time.LocalDate.now().toString()
                val tomorrow = java.time.LocalDate.now().plusDays(1).toString()

                if (tasks != null) {
                    for (i in 0 until tasks.length()) {
                        val task = tasks.getJSONObject(i)
                        val status = task.optString("status", "")
                        if (status == "Done") continue
                        val dueDate = task.optString("dueDate", "")
                        val priority = task.optString("priority", "")
                        if (dueDate < today) {
                            score++
                        } else if (dueDate == today) {
                            score++
                        } else if (dueDate == tomorrow && (priority == "Critical" || priority == "High")) {
                            score++
                        }
                    }
                }

                if (score > 0) {
                    val serviceIntent = Intent(context, FloatingBubbleService::class.java).apply {
                        putExtra("count", score)
                        putExtra("message", "$score Urgent ${if (score == 1) "Task" else "Tasks"}")
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
