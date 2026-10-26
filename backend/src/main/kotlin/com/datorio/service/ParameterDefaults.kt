package com.datorio.service

import java.time.LocalDate

/**
 * Default value of a report parameter: plain text, or a date token resolved on the given day
 * (today, start_of_year, start_of_month, end_of_year in the forms "today", "__today__", "${today}").
 * Shared by the report render and by the job buttons, so both see the same defaults.
 */
object ParameterDefaults {

    fun resolve(raw: String?, today: LocalDate = LocalDate.now()): String? {
        if (raw == null) return null
        return when (raw.trim().lowercase()) {
            "today", "__today__", "${'$'}{today}" -> today.toString()
            "start_of_year", "__start_of_year__", "${'$'}{start_of_year}" -> today.withDayOfYear(1).toString()
            "start_of_month", "__start_of_month__", "${'$'}{start_of_month}" -> today.withDayOfMonth(1).toString()
            "end_of_year", "__end_of_year__", "${'$'}{end_of_year}" -> today.withMonth(12).withDayOfMonth(31).toString()
            else -> raw
        }
    }
}
