package com.datalens

import com.datalens.model.*
import com.datalens.model.dto.*
import com.datalens.repository.*
import com.datalens.service.*
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.*
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import java.time.Instant
import java.util.*

class ReportServiceTest {

    private lateinit var reportRepo: ReportRepository
    private lateinit var paramRepo: ReportParameterRepository
    private lateinit var widgetRepo: ReportWidgetRepository
    private lateinit var dashboardReportRepo: DashboardReportRepository
    private lateinit var scheduleRepo: ReportScheduleRepository
    private lateinit var snapshotRepo: ReportSnapshotRepository
    private lateinit var reportService: ReportService

    @BeforeEach
    fun setup() {
        reportRepo = mock()
        paramRepo = mock()
        widgetRepo = mock()
        dashboardReportRepo = mock()
        scheduleRepo = mock()
        snapshotRepo = mock()
        reportService = ReportService(reportRepo, paramRepo, widgetRepo, dashboardReportRepo, scheduleRepo, snapshotRepo)
    }

    @Nested
    inner class CreateReport {

        @Test
        fun `should create report with parameters and widgets`() {
            val request = CreateReportRequest(
                name = "Sales Overview",
                description = "Monthly sales report",
                parameters = listOf(
                    ReportParameterDto(
                        name = "dateFrom", label = "Start Date",
                        paramType = ParamType.DATE, isRequired = true
                    ),
                    ReportParameterDto(
                        name = "region", label = "Region",
                        paramType = ParamType.SELECT, defaultValue = "ALL"
                    )
                ),
                widgets = listOf(
                    CreateWidgetRequest(
                        widgetType = WidgetType.CHART, title = "Revenue Chart",
                        queryId = 1L, chartConfig = """{"type":"bar"}""",
                        position = """{"x":0,"y":0,"w":6,"h":4}"""
                    ),
                    CreateWidgetRequest(
                        widgetType = WidgetType.TABLE, title = "Sales Table",
                        queryId = 2L
                    )
                )
            )

            whenever(reportRepo.save(any<Report>())).thenAnswer { invocation ->
                val report = invocation.getArgument<Report>(0)
                report
            }

            val result = reportService.createReport(request, userId = 1L)

            assertEquals("Sales Overview", result.name)
            assertEquals(2, result.parameters.size)
            assertEquals(2, result.widgets.size)
            assertEquals("dateFrom", result.parameters[0].name)
            assertEquals(ParamType.DATE, result.parameters[0].paramType)
            assertEquals(WidgetType.CHART, result.widgets[0].widgetType)
            assertEquals(WidgetType.TABLE, result.widgets[1].widgetType)

            verify(reportRepo, times(2)).save(any<Report>())
        }

        @Test
        fun `should create minimal report without params or widgets`() {
            val request = CreateReportRequest(name = "Empty Report")

            whenever(reportRepo.save(any<Report>())).thenAnswer { it.getArgument<Report>(0) }

            val result = reportService.createReport(request, userId = 1L)

            assertEquals("Empty Report", result.name)
            assertEquals(ReportType.STANDARD, result.reportType)
            assertEquals(ReportStatus.DRAFT, result.status)
            assertTrue(result.parameters.isEmpty())
            assertTrue(result.widgets.isEmpty())
        }
    }

    @Nested
    inner class GetAndList {

        @Test
        fun `should get report by id`() {
            val report = createTestReport(1L, "Test Report")
            whenever(reportRepo.findById(1L)).thenReturn(Optional.of(report))

            val result = reportService.getReport(1L)

            assertEquals(1L, result.id)
            assertEquals("Test Report", result.name)
        }

        @Test
        fun `should throw on missing report`() {
            whenever(reportRepo.findById(999L)).thenReturn(Optional.empty())

            assertThrows<IllegalArgumentException> {
                reportService.getReport(999L)
            }
        }

        @Test
        fun `should list reports with pagination`() {
            val reports = listOf(
                createTestReport(1L, "Report A"),
                createTestReport(2L, "Report B")
            )
            val page = PageImpl(reports, PageRequest.of(0, 20), 2)
            whenever(reportRepo.findFiltered(any(), any(), any(), any())).thenReturn(page)

            val result = reportService.listReports(pageable = PageRequest.of(0, 20))

            assertEquals(2, result.totalElements)
            assertEquals("Report A", result.content[0].name)
        }

        @Test
        fun `should search reports by name`() {
            val reports = listOf(createTestReport(1L, "Sales Report"))
            val page = PageImpl(reports, PageRequest.of(0, 20), 1)
            whenever(reportRepo.searchByName(eq("Sales"), any())).thenReturn(page)

            val result = reportService.searchReports("Sales", PageRequest.of(0, 20))

            assertEquals(1, result.totalElements)
            assertEquals("Sales Report", result.content[0].name)
        }
    }

    @Nested
    inner class UpdateAndPublish {

        @Test
        fun `should update report fields`() {
            val report = createTestReport(1L, "Old Name")
            whenever(reportRepo.findById(1L)).thenReturn(Optional.of(report))
            whenever(reportRepo.save(any<Report>())).thenAnswer { it.getArgument<Report>(0) }

            val result = reportService.updateReport(
                1L,
                UpdateReportRequest(name = "New Name", status = ReportStatus.PUBLISHED),
                userId = 1L
            )

            assertEquals("New Name", result.name)
            assertEquals(ReportStatus.PUBLISHED, result.status)
        }

        @Test
        fun `should publish report`() {
            val report = createTestReport(1L, "Draft Report")
            whenever(reportRepo.findById(1L)).thenReturn(Optional.of(report))
            whenever(reportRepo.save(any<Report>())).thenAnswer { it.getArgument<Report>(0) }

            val result = reportService.publishReport(1L, userId = 1L)

            assertEquals(ReportStatus.PUBLISHED, result.status)
        }

        @Test
        fun `should archive report`() {
            val report = createTestReport(1L, "Active Report")
            whenever(reportRepo.findById(1L)).thenReturn(Optional.of(report))
            whenever(reportRepo.save(any<Report>())).thenAnswer { it.getArgument<Report>(0) }

            val result = reportService.archiveReport(1L, userId = 1L)

            assertEquals(ReportStatus.ARCHIVED, result.status)
        }
    }

    @Nested
    inner class Duplicate {

        @Test
        fun `should duplicate report with all params and widgets`() {
            val source = createTestReport(1L, "Original")
            source.parameters.add(ReportParameter(
                id = 10L, report = source, name = "date",
                paramType = ParamType.DATE
            ))
            source.widgets.add(ReportWidget(
                id = 20L, report = source, widgetType = WidgetType.CHART,
                title = "Chart 1", queryId = 5L,
                chartConfig = """{"type":"line"}"""
            ))
            whenever(reportRepo.findById(1L)).thenReturn(Optional.of(source))
            whenever(reportRepo.save(any<Report>())).thenAnswer { it.getArgument<Report>(0) }

            val result = reportService.duplicateReport(1L, "Copy of Original", userId = 1L)

            assertEquals("Copy of Original", result.name)
            assertEquals(1, result.parameters.size)
            assertEquals(1, result.widgets.size)
            assertEquals(ReportStatus.DRAFT, result.status)
        }
    }

    @Nested
    inner class Widgets {

        @Test
        fun `should add widget to report`() {
            val report = createTestReport(1L, "Test Report")
            whenever(reportRepo.findById(1L)).thenReturn(Optional.of(report))
            whenever(reportRepo.save(any<Report>())).thenAnswer { it.getArgument<Report>(0) }

            val request = CreateWidgetRequest(
                widgetType = WidgetType.KPI,
                title = "Total Revenue",
                queryId = 3L,
                position = """{"x":0,"y":0,"w":3,"h":2}"""
            )

            val result = reportService.addWidget(1L, request, userId = 1L)

            assertEquals(WidgetType.KPI, result.widgetType)
            assertEquals("Total Revenue", result.title)
        }

        @Test
        fun `should update widget`() {
            val widget = ReportWidget(
                id = 5L, widgetType = WidgetType.CHART,
                title = "Old Title", chartConfig = """{"type":"bar"}"""
            )
            whenever(widgetRepo.findById(5L)).thenReturn(Optional.of(widget))
            whenever(widgetRepo.save(any<ReportWidget>())).thenAnswer { it.getArgument<ReportWidget>(0) }

            val result = reportService.updateWidget(
                5L,
                UpdateWidgetRequest(title = "New Title", chartConfig = """{"type":"line"}"""),
                userId = 1L
            )

            assertEquals("New Title", result.title)
            assertEquals("""{"type":"line"}""", result.chartConfig)
        }

        @Test
        fun `should list widgets for report`() {
            val widgets = listOf(
                ReportWidget(id = 1L, widgetType = WidgetType.CHART, title = "Chart A"),
                ReportWidget(id = 2L, widgetType = WidgetType.TABLE, title = "Table B")
            )
            whenever(widgetRepo.findByReportIdOrderBySortOrder(1L)).thenReturn(widgets)

            val result = reportService.getWidgets(1L)

            assertEquals(2, result.size)
            assertEquals("Chart A", result[0].title)
            assertEquals("Table B", result[1].title)
        }
    }

    @Nested
    inner class Parameters {

        @Test
        fun `should set parameters for report`() {
            val report = createTestReport(1L, "Parameterized Report")
            whenever(reportRepo.findById(1L)).thenReturn(Optional.of(report))
            whenever(reportRepo.save(any<Report>())).thenAnswer { it.getArgument<Report>(0) }

            val params = listOf(
                ReportParameterDto(name = "startDate", paramType = ParamType.DATE),
                ReportParameterDto(name = "category", paramType = ParamType.SELECT, defaultValue = "ALL")
            )

            val result = reportService.setParameters(1L, params, userId = 1L)

            assertEquals(2, result.size)
            assertEquals("startDate", result[0].name)
            assertEquals("category", result[1].name)
        }
    }

    // ── Helpers ──

    private fun createTestReport(id: Long, name: String): Report {
        return Report(id = id, name = name, createdBy = 1L, updatedBy = 1L)
    }
}

class ReportScheduleServiceTest {

    private lateinit var scheduleRepo: ReportScheduleRepository
    private lateinit var reportRepo: ReportRepository
    private lateinit var renderService: ReportRenderService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var scheduleService: ReportScheduleService

    @BeforeEach
    fun setup() {
        scheduleRepo = mock()
        reportRepo = mock()
        renderService = mock()
        objectMapper = jacksonObjectMapper()
        scheduleService = ReportScheduleService(scheduleRepo, reportRepo, renderService, objectMapper)
    }

    @Test
    fun `should create schedule with valid cron`() {
        whenever(reportRepo.existsById(1L)).thenReturn(true)
        whenever(reportRepo.findById(1L)).thenReturn(Optional.of(
            Report(id = 1L, name = "Test Report")
        ))
        whenever(scheduleRepo.save(any<ReportSchedule>())).thenAnswer {
            val s = it.getArgument<ReportSchedule>(0)
            ReportSchedule(
                id = 1L, reportId = s.reportId,
                cronExpression = s.cronExpression,
                outputFormat = s.outputFormat
            )
        }

        val request = CreateScheduleRequest(
            reportId = 1L,
            cronExpression = "0 8 * * 1",
            outputFormat = OutputFormat.JSON
        )

        val result = scheduleService.createSchedule(request, userId = 1L)

        assertEquals(1L, result.reportId)
        assertEquals("0 8 * * 1", result.cronExpression)
        assertTrue(result.isActive)
    }

    @Test
    fun `should reject invalid cron expression`() {
        whenever(reportRepo.existsById(1L)).thenReturn(true)

        val request = CreateScheduleRequest(
            reportId = 1L,
            cronExpression = "invalid"
        )

        assertThrows<IllegalArgumentException> {
            scheduleService.createSchedule(request, userId = 1L)
        }
    }

    @Test
    fun `should toggle schedule active state`() {
        val schedule = ReportSchedule(
            id = 1L, reportId = 1L,
            cronExpression = "0 8 * * 1",
            isActive = true
        )
        whenever(scheduleRepo.findById(1L)).thenReturn(Optional.of(schedule))
        whenever(scheduleRepo.save(any<ReportSchedule>())).thenAnswer { it.getArgument<ReportSchedule>(0) }
        whenever(reportRepo.findById(1L)).thenReturn(Optional.of(Report(id = 1L, name = "Test")))

        val result = scheduleService.toggleSchedule(1L)

        assertFalse(result.isActive)
    }
}
