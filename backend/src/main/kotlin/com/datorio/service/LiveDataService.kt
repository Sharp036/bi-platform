package com.datorio.service

import com.datorio.model.dto.RenderReportResponse
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Manages Server-Sent Event (SSE) subscriptions for live dashboard updates.
 *
 * Flow:
 *   1. Client opens SSE connection via GET /live/subscribe?reportId=X
 *   2. Server holds SseEmitter for each subscription
 *   3. When report data changes (render, schedule, manual push), notifyReport() is called
 *   4. All subscribers for that report receive the updated data as SSE event
 *
 * Subscriptions are in-memory — no database needed.
 */
@Service
class LiveDataService(
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Key: reportId → list of active SSE emitters
     */
    private val subscriptions = ConcurrentHashMap<Long, CopyOnWriteArrayList<SubscriptionEntry>>()

    /**
     * Track last event per report for late-joining clients
     */
    private val lastEvents = ConcurrentHashMap<Long, LiveEvent>()

    companion object {
        /** SSE connection timeout: 30 minutes */
        const val SSE_TIMEOUT_MS = 30L * 60 * 1000
        /** Heartbeat every 25 seconds to keep connection alive */
        const val HEARTBEAT_INTERVAL_MS = 25_000L
    }

    data class SubscriptionEntry(
        val emitter: SseEmitter,
        val userId: Long,
        val createdAt: Long = System.currentTimeMillis()
    )

    data class LiveEvent(
        val type: String,
        val reportId: Long,
        val data: Any?,
        val timestamp: Long = System.currentTimeMillis()
    )

    // ═══════════════════════════════════════════
    //  Subscribe
    // ═══════════════════════════════════════════

    fun subscribe(reportId: Long, userId: Long): SseEmitter {
        val emitter = SseEmitter(SSE_TIMEOUT_MS)
        val entry = SubscriptionEntry(emitter, userId)

        val list = subscriptions.computeIfAbsent(reportId) { CopyOnWriteArrayList() }
        list.add(entry)

        // Cleanup on completion/timeout/error
        val cleanup = Runnable {
            list.remove(entry)
            if (list.isEmpty()) subscriptions.remove(reportId)
            log.debug("SSE subscription removed for report {} (user {})", reportId, userId)
        }
        emitter.onCompletion(cleanup)
        emitter.onTimeout(cleanup)
        emitter.onError { cleanup.run() }

        log.info("SSE subscription created for report {} (user {}). Total subs: {}", reportId, userId, list.size)

        // Send initial connection event
        try {
            emitter.send(
                SseEmitter.event()
                    .name("connected")
                    .data(mapOf("reportId" to reportId, "message" to "Subscribed to live updates"))
            )
        } catch (e: Exception) {
            log.warn("Failed to send initial SSE event: {}", e.message)
        }

        // Send last known event if available (for reconnecting clients)
        lastEvents[reportId]?.let { lastEvent ->
            try {
                emitter.send(
                    SseEmitter.event()
                        .name(lastEvent.type)
                        .data(lastEvent.data ?: "")
                )
            } catch (e: Exception) {
                log.debug("Failed to send last event on reconnect: {}", e.message)
            }
        }

        return emitter
    }

    // ═══════════════════════════════════════════
    //  Push Notifications
    // ═══════════════════════════════════════════

    /**
     * Notify all subscribers of a report that new data is available.
     * Called after report render, scheduled execution, etc.
     */
    fun notifyReportUpdate(reportId: Long, renderResponse: RenderReportResponse?) {
        val event = LiveEvent(
            type = "report-update",
            reportId = reportId,
            data = renderResponse?.let {
                mapOf(
                    "reportId" to reportId,
                    "widgetCount" to it.widgets.size,
                    "executionMs" to it.executionMs,
                    "timestamp" to System.currentTimeMillis()
                )
            }
        )
        lastEvents[reportId] = event
        broadcast(reportId, event)
    }

    /**
     * Notify that a specific widget's data changed.
     */
    fun notifyWidgetUpdate(reportId: Long, widgetId: Long, data: Any?) {
        val event = LiveEvent(
            type = "widget-update",
            reportId = reportId,
            data = mapOf(
                "reportId" to reportId,
                "widgetId" to widgetId,
                "data" to data,
                "timestamp" to System.currentTimeMillis()
            )
        )
        broadcast(reportId, event)
    }

    /**
     * Send a custom event to report subscribers (e.g., data alert triggered).
     */
    fun notifyCustomEvent(reportId: Long, eventName: String, payload: Any?) {
        val event = LiveEvent(
            type = eventName,
            reportId = reportId,
            data = mapOf(
                "reportId" to reportId,
                "payload" to payload,
                "timestamp" to System.currentTimeMillis()
            )
        )
        broadcast(reportId, event)
    }

    // ═══════════════════════════════════════════
    //  Stats & Management
    // ═══════════════════════════════════════════

    fun getActiveSubscriptions(): Map<Long, Int> =
        subscriptions.mapValues { it.value.size }

    fun getSubscriberCount(reportId: Long): Int =
        subscriptions[reportId]?.size ?: 0

    fun disconnectAll(reportId: Long) {
        subscriptions.remove(reportId)?.forEach { entry ->
            try { entry.emitter.complete() } catch (_: Exception) {}
        }
    }

    // ═══════════════════════════════════════════
    //  Heartbeat (keeps SSE connections alive)
    // ═══════════════════════════════════════════

    @Scheduled(fixedRate = HEARTBEAT_INTERVAL_MS)
    fun sendHeartbeats() {
        if (subscriptions.isEmpty()) return

        var sent = 0
        var removed = 0
        subscriptions.forEach { (reportId, entries) ->
            val dead = mutableListOf<SubscriptionEntry>()
            entries.forEach { entry ->
                try {
                    entry.emitter.send(
                        SseEmitter.event()
                            .name("heartbeat")
                            .data(mapOf("ts" to System.currentTimeMillis()))
                    )
                    sent++
                } catch (e: Exception) {
                    dead.add(entry)
                    removed++
                }
            }
            entries.removeAll(dead)
            if (entries.isEmpty()) subscriptions.remove(reportId)
        }

        if (sent > 0 || removed > 0) {
            log.debug("SSE heartbeat: sent={}, removed={}, total_reports={}", sent, removed, subscriptions.size)
        }
    }

    // ═══════════════════════════════════════════
    //  Internal
    // ═══════════════════════════════════════════

    private fun broadcast(reportId: Long, event: LiveEvent) {
        val entries = subscriptions[reportId] ?: return
        if (entries.isEmpty()) return

        val dead = mutableListOf<SubscriptionEntry>()
        var sentCount = 0

        entries.forEach { entry ->
            try {
                entry.emitter.send(
                    SseEmitter.event()
                        .name(event.type)
                        .data(event.data ?: "")
                )
                sentCount++
            } catch (e: Exception) {
                dead.add(entry)
            }
        }
        entries.removeAll(dead)
        if (entries.isEmpty()) subscriptions.remove(reportId)

        log.debug("Broadcast '{}' to report {}: sent={}, dead={}", event.type, reportId, sentCount, dead.size)
    }
}
