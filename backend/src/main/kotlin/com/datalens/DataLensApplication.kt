package com.datalens

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
class DataLensApplication

fun main(args: Array<String>) {
    runApplication<DataLensApplication>(*args)
}
