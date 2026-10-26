package com.datorio.service

import com.datorio.model.ParamType
import com.datorio.model.ReportParameter
import java.math.BigDecimal
import java.time.LocalDate

/**
 * Builds the run configuration of a job started by a RUN_JOB button from the report parameters.
 *
 * - Only the parameters listed in [include] are sent (all report parameters when the list is empty).
 * - A parameter missing from [values] takes its report default, like in the report render.
 * - A blank value is not sent, so the job applies its own default.
 * - Values are typed by the parameter type: NUMBER -> integer or decimal, MULTI_SELECT -> list
 *   (the report sends "a,b,c"), BOOLEAN -> true/false, other types -> trimmed text.
 * - [userParam] always receives the name of the user who pressed the button.
 * - [emailParam] receives the user's email when the report leaves it empty.
 */
object JobConfBuilder {

    fun build(
        parameters: List<ReportParameter>,
        values: Map<String, Any?>,
        include: List<String>,
        userParam: String?,
        username: String,
        emailParam: String?,
        email: String?,
        today: LocalDate = LocalDate.now()
    ): Map<String, Any?> {
        val byName = parameters.associateBy { it.name }
        val unknown = include.filter { it !in byName }
        require(unknown.isEmpty()) { "Job parameters not found in the report: ${unknown.joinToString(", ")}" }
        val selected = if (include.isEmpty()) parameters.sortedBy { it.sortOrder } else include.map { byName.getValue(it) }

        val conf = linkedMapOf<String, Any?>()
        for (p in selected) {
            val raw = if (values.containsKey(p.name)) values[p.name] else ParameterDefaults.resolve(p.defaultValue, today)
            val typed = convert(p, raw) ?: continue
            conf[p.name] = typed
        }
        if (!userParam.isNullOrBlank()) {
            conf[userParam] = username
        }
        if (!emailParam.isNullOrBlank() && !email.isNullOrBlank()) {
            val current = conf[emailParam]
            if (current == null || (current is String && current.isBlank())) {
                conf[emailParam] = email
            }
        }
        return conf
    }

    private fun convert(p: ReportParameter, raw: Any?): Any? {
        if (raw == null) return null
        return when (p.paramType) {
            ParamType.NUMBER -> toNumber(p, raw)
            ParamType.MULTI_SELECT -> {
                val items = when (raw) {
                    is Collection<*> -> raw.mapNotNull { it?.toString()?.trim() }
                    else -> raw.toString().split(',').map { it.trim() }
                }.filter { it.isNotEmpty() }
                items.ifEmpty { null }
            }
            ParamType.BOOLEAN -> when (raw) {
                is Boolean -> raw
                else -> when (raw.toString().trim().lowercase()) {
                    "" -> null
                    "true" -> true
                    "false" -> false
                    else -> throw IllegalArgumentException("Parameter '${p.label ?: p.name}' must be true or false")
                }
            }
            else -> raw.toString().trim().ifEmpty { null }
        }
    }

    private fun toNumber(p: ReportParameter, raw: Any): Number? {
        val text = raw.toString().trim().replace(',', '.')
        if (text.isEmpty()) return null
        val value = text.toBigDecimalOrNull()
            ?: throw IllegalArgumentException("Parameter '${p.label ?: p.name}' must be a number, got '$raw'")
        val stripped = value.stripTrailingZeros()
        return if (stripped.scale() <= 0 && stripped.abs() < BigDecimal(Long.MAX_VALUE)) stripped.toLong() else value.toDouble()
    }
}
