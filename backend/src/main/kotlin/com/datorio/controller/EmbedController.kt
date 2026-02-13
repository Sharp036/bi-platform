package com.datorio.controller

import com.datorio.model.dto.*
import com.datorio.service.EmbedService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*

// ─────────────────────────────────────────────
//  Admin: manage embed tokens (auth required)
// ─────────────────────────────────────────────

@RestController
@RequestMapping("/embed-tokens")
class EmbedTokenController(
    private val embedService: EmbedService
) {

    @PostMapping
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun create(@RequestBody request: EmbedTokenCreateRequest): ResponseEntity<EmbedTokenResponse> {
        return ResponseEntity.status(HttpStatus.CREATED).body(embedService.createToken(request))
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getById(@PathVariable id: Long): EmbedTokenResponse {
        return embedService.getToken(id)
    }

    @GetMapping("/report/{reportId}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun listForReport(@PathVariable reportId: Long): List<EmbedTokenResponse> {
        return embedService.listTokensForReport(reportId)
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun revoke(@PathVariable id: Long): ResponseEntity<Void> {
        embedService.revokeToken(id)
        return ResponseEntity.noContent().build()
    }
}

// ─────────────────────────────────────────────
//  Public: render via embed token (NO auth)
// ─────────────────────────────────────────────

@RestController
@RequestMapping("/embed")
class EmbedRenderController(
    private val embedService: EmbedService
) {

    /**
     * Render report data via embed token.
     * This endpoint is PUBLIC — no JWT required.
     * Security is based on the token validity.
     */
    @GetMapping("/{token}")
    fun renderEmbed(
        @PathVariable token: String,
        @RequestParam params: Map<String, String>,
        @RequestHeader(value = "Origin", required = false) origin: String?
    ): ResponseEntity<RenderReportResponse> {
        // CORS check
        if (!embedService.isOriginAllowed(token, origin)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build()
        }

        val extraParams: Map<String, Any?> = params.filterKeys { it != "token" }
        val result = embedService.renderByToken(token, extraParams)

        return ResponseEntity.ok()
            .header("X-Frame-Options", "ALLOWALL")
            .header("Access-Control-Allow-Origin", origin ?: "*")
            .body(result)
    }
}
