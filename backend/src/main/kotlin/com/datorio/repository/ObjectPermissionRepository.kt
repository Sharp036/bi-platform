package com.datorio.repository

import com.datorio.model.ObjectPermission
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository

@Repository
interface ObjectPermissionRepository : JpaRepository<ObjectPermission, Long> {

    fun findByObjectTypeAndObjectId(objectType: String, objectId: Long): List<ObjectPermission>

    fun findByObjectTypeAndObjectIdAndUserId(
        objectType: String, objectId: Long, userId: Long
    ): ObjectPermission?

    fun findByObjectTypeAndObjectIdAndRoleId(
        objectType: String, objectId: Long, roleId: Long
    ): ObjectPermission?

    fun deleteByObjectTypeAndObjectIdAndUserId(
        objectType: String, objectId: Long, userId: Long
    )

    fun deleteByObjectTypeAndObjectIdAndRoleId(
        objectType: String, objectId: Long, roleId: Long
    )

    fun deleteByObjectTypeAndObjectId(objectType: String, objectId: Long)

    /** Find all objects shared directly with a user */
    fun findByUserId(userId: Long): List<ObjectPermission>

    /** Find all objects shared with any of the given role IDs */
    fun findByRoleIdIn(roleIds: List<Long>): List<ObjectPermission>

    /** Check if user has direct permission on object */
    @Query("""
        SELECT COUNT(op) > 0 FROM ObjectPermission op 
        WHERE op.objectType = :objectType 
        AND op.objectId = :objectId 
        AND (op.user.id = :userId OR op.role.id IN :roleIds)
    """)
    fun hasAccess(
        objectType: String,
        objectId: Long,
        userId: Long,
        roleIds: List<Long>
    ): Boolean

    /** Get max access level for user (directly or through roles) */
    @Query("""
        SELECT op.accessLevel FROM ObjectPermission op 
        WHERE op.objectType = :objectType 
        AND op.objectId = :objectId 
        AND (op.user.id = :userId OR op.role.id IN :roleIds)
        ORDER BY CASE op.accessLevel 
            WHEN 'ADMIN' THEN 3 
            WHEN 'EDIT' THEN 2 
            WHEN 'VIEW' THEN 1 
            ELSE 0 END DESC
    """)
    fun getAccessLevels(
        objectType: String,
        objectId: Long,
        userId: Long,
        roleIds: List<Long>
    ): List<String>
}
