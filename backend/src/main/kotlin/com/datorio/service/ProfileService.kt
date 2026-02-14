package com.datorio.service

import com.datorio.model.dto.ChangePasswordRequest
import com.datorio.repository.UserRepository
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

@Service
class ProfileService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val auditService: AuditService
) {

    @Transactional
    fun changePassword(username: String, request: ChangePasswordRequest) {
        val user = userRepository.findByUsername(username)
            .orElseThrow { NoSuchElementException("User not found: $username") }

        require(passwordEncoder.matches(request.currentPassword, user.passwordHash)) {
            "Current password is incorrect"
        }
        require(request.newPassword.length >= 6) {
            "New password must be at least 6 characters"
        }

        user.passwordHash = passwordEncoder.encode(request.newPassword)
        user.updatedAt = OffsetDateTime.now()
        userRepository.save(user)

        auditService.log(username, "PASSWORD_CHANGE", "USER", user.id)
    }

    @Transactional
    fun updateLanguage(username: String, language: String) {
        require(language.length in 2..10) { "Invalid language code" }
        val user = userRepository.findByUsername(username)
            .orElseThrow { NoSuchElementException("User not found: $username") }
        user.language = language
        user.updatedAt = OffsetDateTime.now()
        userRepository.save(user)
        auditService.log(username, "LANGUAGE_CHANGE", "USER", user.id)
    }
}
