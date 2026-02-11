package com.datalens

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles

@SpringBootTest
@ActiveProfiles("test")
class DataLensApplicationTests {

    @Test
    fun contextLoads() {
        // Verifies the Spring context starts up without errors
    }
}
