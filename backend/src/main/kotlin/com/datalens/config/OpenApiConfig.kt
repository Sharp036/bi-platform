package com.datalens.config

import io.swagger.v3.oas.models.Components
import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.info.Info
import io.swagger.v3.oas.models.security.SecurityRequirement
import io.swagger.v3.oas.models.security.SecurityScheme
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class OpenApiConfig {

    @Bean
    fun openAPI(): OpenAPI {
        return OpenAPI()
            .info(
                Info()
                    .title("DataLens BI API")
                    .version("0.2.0")
                    .description(
                        "Business Intelligence Platform — REST API.\n\n" +
                        "Authenticate via POST /auth/login, then click Authorize " +
                        "and paste the accessToken value (without 'Bearer' prefix)."
                    )
            )
            .addSecurityItem(SecurityRequirement().addList("Bearer Token"))
            .components(
                Components().addSecuritySchemes(
                    "Bearer Token",
                    SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("JWT access token from /auth/login")
                )
            )
    }
}
