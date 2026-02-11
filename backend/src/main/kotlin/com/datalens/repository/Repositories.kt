package com.datalens.repository

import com.datalens.model.DataSource
import com.datalens.model.Role
import com.datalens.model.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.Optional

@Repository
interface UserRepository : JpaRepository<User, Long> {
    fun findByUsername(username: String): Optional<User>
    fun findByEmail(email: String): Optional<User>
    fun existsByUsername(username: String): Boolean
    fun existsByEmail(email: String): Boolean
}

@Repository
interface RoleRepository : JpaRepository<Role, Long> {
    fun findByName(name: String): Optional<Role>
}

@Repository
interface DataSourceRepository : JpaRepository<DataSource, Long> {
    fun findByIsActiveTrue(): List<DataSource>
    fun findByCreatedById(userId: Long): List<DataSource>
}
