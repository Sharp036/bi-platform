package com.datorio.controller

import com.datorio.repository.UserRepository
import com.datorio.service.LiveDataService
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

/**
 * SSE (Server-Sent Events) endpoints for real-time dashboard updates.
 *
 * Usage:
 *   const es = new EventSource('/live/subscribe?reportId=5&token=xxx')
 *   es.addEventListener('report-update', (e) => { ... })
 *   es.addEventListener('widget-update', (e) => { ... })
 *   es.addEventListener('heartbeat', (e) => { ... })
 */
@RestController
@RequestMapping("/live")
class LiveDataController(
    private val liveDataService: LiveDataService,
    private val userRepository: UserRepository
) {

    private fun getUserId(auth: Authentication): Long =
        userRepository.findByUsername(auth.name)
            .orElseThrow { NoSuchElementException("User not found") }.id

    /**
     * Subscribe to live updates for a report.
     * Returns an SSE stream that stays open.
     *
     * Events:
     *   - "connected"       : initial confirmation
     *   - "report-update"   : full report data refresh
     *   - "widget-update"   : single widget data changed
     *   - "heartbeat"       : keep-alive every 25s
     */
    @GetMapping("/subscribe", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun subscribe(
        @RequestParam reportId: Long,
        auth: Authentication
    ): SseEmitter {
        val userId = getUserId(auth)
        return liveDataService.subscribe(reportId, userId)
    }

    /**
     * Manually trigger a push update to all subscribers of a report.
     * Useful for testing or admin-triggered refreshes.
     */
    @PostMapping("/push/{reportId}")
    fun pushUpdate(
        @PathVariable reportId: Long,
        @RequestBody(required = false) payload: Map<String, Any?>?
    ): ResponseEntity<Map<String, Any>> {
        val count = liveDataService.getSubscriberCount(reportId)
        liveDataService.notifyCustomEvent(reportId, "manual-refresh", payload)
        return ResponseEntity.ok(mapOf(
            "reportId" to reportId,
            "subscribersNotified" to count
        ))
    }

    /**
     * Get active subscription stats.
     */
    @GetMapping("/stats")
    fun stats(): ResponseEntity<Map<String, Any>> {
        val subs = liveDataService.getActiveSubscriptions()
        return ResponseEntity.ok(mapOf(
            "totalReports" to subs.size,
            "totalSubscriptions" to subs.values.sum(),
            "reports" to subs
        ))
    }

    /**
     * Disconnect all subscribers for a report.
     */
    @DeleteMapping("/disconnect/{reportId}")
    fun disconnect(@PathVariable reportId: Long): ResponseEntity<Void> {
        liveDataService.disconnectAll(reportId)
        return ResponseEntity.noContent().build()
    }
}
