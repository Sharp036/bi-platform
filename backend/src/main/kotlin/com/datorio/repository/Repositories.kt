package com.datorio.repository

import com.datorio.model.DataSource
import com.datorio.model.Role
import com.datorio.model.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import java.util.Optional

@Repository
interface UserRepository : JpaRepository<User, Long> {
    fun findByUsername(username: String): Optional<User>
    fun findByEmail(email: String): Optional<User>
    fun existsByUsername(username: String): Boolean
    fun existsByEmail(email: String): Boolean
    fun findByUsernameContainingIgnoreCaseOrEmailContainingIgnoreCase(
        username: String, email: String, pageable: Pageable
    ): Page<User>

    fun countByRolesId(roleId: Long): Long
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
