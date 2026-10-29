package com.datorio

import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.*
import com.datorio.service.*
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.*
import org.springframework.transaction.PlatformTransactionManager
import java.util.*

class ReportRenderServiceTest {

    private lateinit var liveDataService: LiveDataService
    private lateinit var renderService: ReportRenderService

    @BeforeEach
    fun setup() {
        val report = Report(id = 1L, name = "Report", createdBy = 1L, updatedBy = 1L)
        val reportRepo: ReportRepository = mock()
        whenever(reportRepo.findById(1L)).thenReturn(Optional.of(report))
        val widgetRepo: ReportWidgetRepository = mock()
        whenever(widgetRepo.findByReportIdOrderBySortOrder(1L)).thenReturn(listOf(
            ReportWidget(id = 11L, report = report, widgetType = WidgetType.SPACER, sortOrder = 0),
            ReportWidget(id = 12L, report = report, widgetType = WidgetType.SPACER, sortOrder = 1),
            ReportWidget(id = 13L, report = report, widgetType = WidgetType.SPACER, sortOrder = 2, isVisible = false)
        ))
        liveDataService = mock()
        renderService = ReportRenderService(reportRepo, widgetRepo, mock(), mock(), jacksonObjectMapper(),
            liveDataService, mock<PlatformTransactionManager>())
    }

    @Test
    fun `full render returns every visible widget and notifies live subscribers`() {
        val result = renderService.renderReport(1L, RenderReportRequest(), "user")

        assertEquals(listOf(11L, 12L), result.widgets.map { it.widgetId })
        verify(liveDataService).notifyReportUpdate(eq(1L), any())
    }

    @Test
    fun `render of chosen widgets returns the visible ones among them without a live event`() {
        val result = renderService.renderReport(1L, RenderReportRequest(widgetIds = listOf(12L, 13L)), "user")

        assertEquals(listOf(12L), result.widgets.map { it.widgetId })
        verify(liveDataService, never()).notifyReportUpdate(any(), anyOrNull())
    }
}
