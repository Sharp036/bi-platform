plugins {
    kotlin("jvm")
    kotlin("plugin.spring")
    kotlin("plugin.jpa")
    id("org.springframework.boot")
    id("io.spring.dependency-management")
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

kotlin {
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict")
    }
}

dependencies {
    // ── Spring Boot Core ──
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-cache")

    // ── Kotlin ──
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-reactor:1.8.1")

    // ── Database Drivers ──
    // PostgreSQL — as metadata store AND as user data source
    runtimeOnly("org.postgresql:postgresql")
    // ClickHouse JDBC driver
    implementation("com.clickhouse:clickhouse-jdbc:0.6.3") {
        // Use the HTTP client implementation
        exclude(group = "org.apache.httpcomponents.client5")
    }
    implementation("org.apache.httpcomponents.client5:httpclient5:5.3.1")

    // ── Connection Pooling ──
    implementation("com.zaxxer:HikariCP")

    // ── JWT ──
    implementation("io.jsonwebtoken:jjwt-api:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")

    // ── JavaScript Scripting Engine (GraalJS) ──
    implementation("org.graalvm.polyglot:polyglot:24.0.2")
    implementation("org.graalvm.polyglot:js:24.0.2")

    // ── Export ──
    implementation("org.apache.poi:poi-ooxml:5.3.0")  // Excel
    implementation("jakarta.mail:jakarta.mail-api:2.1.3")
    implementation("org.eclipse.angus:angus-mail:2.0.3")

    // ── Caching ──
    implementation("com.github.ben-manes.caffeine:caffeine:3.1.8")

    // ── API Documentation ──
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.6.0")

    // ── Database Migration ──
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")

    // ── Testing ──
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.testcontainers:postgresql:1.20.3")
    testImplementation("org.testcontainers:clickhouse:1.20.3")
    testImplementation("org.testcontainers:junit-jupiter:1.20.3")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.2.1")
}

tasks.withType<Test> {
    useJUnitPlatform()
}

// Copy frontend build output into Spring Boot's static resources
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    // After Phase 6, uncomment to embed frontend:
    // from("../frontend/dist") { into("static") }
}
