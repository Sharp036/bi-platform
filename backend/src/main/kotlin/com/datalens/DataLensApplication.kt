package com.datalens

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class DataLensApplication

fun main(args: Array<String>) {
    runApplication<DataLensApplication>(*args)
}
