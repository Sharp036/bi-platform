package com.datalens.controller

import com.datalens.model.dto.*
import com.datalens.service.*
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*

// ═══════════════════════════════════════════════
//  Calculated Fields
// ═══════════════════════════════════════════════

@RestController
@RequestMapping("/calculated-fields")
class CalculatedFieldController(
    private val calcService: CalculatedFieldService
) {

    @PostMapping
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun create(@RequestBody request: CalcFieldCreateRequest): ResponseEntity<CalcFieldResponse> {
        return ResponseEntity.status(HttpStatus.CREATED).body(calcService.create(request))
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getById(@PathVariable id: Long): CalcFieldResponse = calcService.getById(id)

    @GetMapping("/report/{reportId}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun listForReport(@PathVariable reportId: Long): List<CalcFieldResponse> =
        calcService.listForReport(reportId)

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun update(@PathVariable id: Long, @RequestBody request: CalcFieldUpdateRequest): CalcFieldResponse =
        calcService.update(id, request)

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun delete(@PathVariable id: Long): ResponseEntity<Void> {
        calcService.delete(id)
        return ResponseEntity.noContent().build()
    }
}

// ═══════════════════════════════════════════════
//  Data Alerts
// ═══════════════════════════════════════════════

@RestController
@RequestMapping("/alerts")
class DataAlertController(
    private val alertService: DataAlertService
) {

    @PostMapping
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun create(@RequestBody request: AlertCreateRequest): ResponseEntity<AlertResponse> {
        return ResponseEntity.status(HttpStatus.CREATED).body(alertService.create(request))
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getById(@PathVariable id: Long): AlertResponse = alertService.getById(id)

    @GetMapping("/report/{reportId}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun listForReport(@PathVariable reportId: Long): List<AlertResponse> =
        alertService.listForReport(reportId)

    @GetMapping("/active")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun listActive(): List<AlertResponse> = alertService.listActive()

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun update(@PathVariable id: Long, @RequestBody request: AlertUpdateRequest): AlertResponse =
        alertService.update(id, request)

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun delete(@PathVariable id: Long): ResponseEntity<Void> {
        alertService.delete(id)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/{id}/check")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun checkAlert(@PathVariable id: Long): AlertCheckResult = alertService.checkAlert(id)

    @PostMapping("/check-all")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun checkAll(): List<AlertCheckResult> = alertService.checkDueAlerts()

    @GetMapping("/{id}/events")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getEvents(
        @PathVariable id: Long,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): List<AlertEventResponse> = alertService.getEvents(id, page, size)
}

// ═══════════════════════════════════════════════
//  Bookmarks
// ═══════════════════════════════════════════════

@RestController
@RequestMapping("/bookmarks")
class BookmarkController(
    private val bookmarkService: BookmarkService
) {

    @PostMapping
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun create(
        @RequestBody request: BookmarkCreateRequest,
        auth: Authentication
    ): ResponseEntity<BookmarkResponse> {
        val userId = getUserId(auth)
        return ResponseEntity.status(HttpStatus.CREATED).body(bookmarkService.create(request, userId))
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getById(@PathVariable id: Long): BookmarkResponse = bookmarkService.getById(id)

    @GetMapping("/report/{reportId}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun listForReport(@PathVariable reportId: Long, auth: Authentication): List<BookmarkResponse> =
        bookmarkService.listForReport(reportId, getUserId(auth))

    @GetMapping("/report/{reportId}/default")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getDefault(@PathVariable reportId: Long): ResponseEntity<BookmarkResponse> {
        val bookmark = bookmarkService.getDefaultBookmark(reportId)
        return if (bookmark != null) ResponseEntity.ok(bookmark)
        else ResponseEntity.noContent().build()
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun update(@PathVariable id: Long, @RequestBody request: BookmarkUpdateRequest): BookmarkResponse =
        bookmarkService.update(id, request)

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun delete(@PathVariable id: Long): ResponseEntity<Void> {
        bookmarkService.delete(id)
        return ResponseEntity.noContent().build()
    }

    private fun getUserId(auth: Authentication): Long {
        return try {
            val principal = auth.principal
            if (principal is org.springframework.security.core.userdetails.UserDetails) {
                principal.username.hashCode().toLong()
            } else { 0L }
        } catch (_: Exception) { 0L }
    }
}
