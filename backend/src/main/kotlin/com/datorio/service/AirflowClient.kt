package com.datorio.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.io.IOException
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration

/** A DAG run accepted by Airflow. */
data class DagRunInfo(val runId: String, val state: String?)

/**
 * Minimal client of the Airflow 3 REST API used by the RUN_JOB buttons: gets a JWT from
 * POST /auth/token with a service account and triggers DAG runs with
 * POST /api/v2/dags/{dagId}/dagRuns. The token is kept until Airflow answers 401.
 *
 * Settings: datorio.airflow.base-url (for example http://host:5080), username, password,
 * timeout-seconds. Without base-url and username the client reports that it is not configured.
 */
@Component
class AirflowClient(
    @Value("\${datorio.airflow.base-url:}") baseUrl: String,
    @Value("\${datorio.airflow.username:}") private val username: String,
    @Value("\${datorio.airflow.password:}") private val password: String,
    @Value("\${datorio.airflow.timeout-seconds:30}") timeoutSeconds: Long
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // Own mapper: the application one drops null fields, and Airflow expects "logical_date": null.
    private val objectMapper = jacksonObjectMapper()
    private val baseUrl = baseUrl.trim().trimEnd('/')
    private val timeout = Duration.ofSeconds(timeoutSeconds)
    // HTTP/1.1 only: the default client asks for an h2c upgrade, and the uvicorn server of Airflow
    // (httptools parser) then drops the request body and answers 400 "Invalid HTTP request received".
    private val http = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_1_1)
        .connectTimeout(Duration.ofSeconds(10))
        .build()

    @Volatile
    private var token: String? = null

    fun isConfigured(): Boolean = baseUrl.isNotEmpty() && username.isNotEmpty()

    fun triggerDagRun(dagId: String, conf: Map<String, Any?>, note: String? = null): DagRunInfo {
        check(isConfigured()) { "Airflow connection is not configured: set datorio.airflow.base-url, username and password" }
        val path = "/api/v2/dags/" + URLEncoder.encode(dagId, StandardCharsets.UTF_8) + "/dagRuns"
        val body = objectMapper.writeValueAsString(
            linkedMapOf("logical_date" to null, "conf" to conf, "note" to note)
        )
        var response = post(path, body, bearer(refresh = false))
        if (response.statusCode() == 401) {
            response = post(path, body, bearer(refresh = true))
        }
        val status = response.statusCode()
        if (status in 200..299) {
            val json: Map<String, Any?> = objectMapper.readValue(response.body())
            val runId = json["dag_run_id"]?.toString()
                ?: throw IllegalStateException("Airflow accepted the run of $dagId but returned no dag_run_id")
            log.info("Airflow DAG {} triggered, run {}", dagId, runId)
            return DagRunInfo(runId, json["state"]?.toString())
        }
        val detail = detail(response.body())
        log.warn("Airflow refused the run of {}: {} {}", dagId, status, detail)
        if (status in 400..499) {
            throw IllegalArgumentException("Airflow refused the run of $dagId ($status): $detail")
        }
        throw IllegalStateException("Airflow error $status on the run of $dagId: $detail")
    }

    private fun bearer(refresh: Boolean): String {
        val current = token
        if (!refresh && current != null) return current
        synchronized(this) {
            if (!refresh && token != null) return token!!
            val body = objectMapper.writeValueAsString(mapOf("username" to username, "password" to password))
            val response = send(
                HttpRequest.newBuilder(URI.create("$baseUrl/auth/token"))
                    .timeout(timeout)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build()
            )
            if (response.statusCode() !in 200..299) {
                throw IllegalStateException("Airflow login failed (${response.statusCode()}): ${detail(response.body())}")
            }
            val json: Map<String, Any?> = objectMapper.readValue(response.body())
            val fresh = json["access_token"]?.toString()
                ?: throw IllegalStateException("Airflow login returned no access_token")
            token = fresh
            return fresh
        }
    }

    private fun post(path: String, body: String, bearer: String): HttpResponse<String> = send(
        HttpRequest.newBuilder(URI.create(baseUrl + path))
            .timeout(timeout)
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer $bearer")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build()
    )

    private fun send(request: HttpRequest): HttpResponse<String> = try {
        http.send(request, HttpResponse.BodyHandlers.ofString())
    } catch (e: IOException) {
        throw IllegalStateException("Airflow is not reachable at $baseUrl: ${e.message}", e)
    } catch (e: InterruptedException) {
        Thread.currentThread().interrupt()
        throw IllegalStateException("Request to Airflow was interrupted", e)
    }

    /** The "detail" field of an Airflow error answer, or the body itself. */
    private fun detail(body: String?): String {
        if (body.isNullOrBlank()) return "no details"
        return try {
            val json: Map<String, Any?> = objectMapper.readValue(body)
            (json["detail"] ?: json["message"] ?: body).toString().take(1000)
        } catch (_: Exception) {
            body.take(1000)
        }
    }
}
