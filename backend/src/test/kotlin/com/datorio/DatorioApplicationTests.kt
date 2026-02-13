package com.datorio

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles

@SpringBootTest
@ActiveProfiles("test")
class DatorioApplicationTests {

    @Test
    fun contextLoads() {
        // Verifies the Spring context starts up without errors
    }
}
