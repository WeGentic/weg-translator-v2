//! Type definitions for Supabase PostgreSQL schema entities.
//!
//! This module defines types for the multi-tenant company management schema
//! stored in Supabase PostgreSQL. These types are separate from the SQLite
//! schema types in `schema.rs` and are used for IPC communication between
//! the Rust backend and React frontend when interacting with cloud data.
//!
//! ## Key Types
//!
//! - **Record Types**: Direct database representations with native types (Uuid, DateTime)
//! - **DTO Types**: Data Transfer Objects for IPC with serialized types (String)
//! - **Payload Types**: Input types for create/update operations
//!
//! ## Type Safety
//!
//! - All database types use `uuid::Uuid` for UUID fields
//! - Timestamps use `chrono::DateTime<Utc>` for proper timezone handling
//! - DTOs convert these to String for JSON serialization across IPC boundary
//! - JSONB address field uses `serde_json::Value` for flexibility

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

// ============================================================================
// Database Record Types
// ============================================================================

/// Row representation of the `companies` table in Supabase PostgreSQL.
///
/// Stores organization/business entities with multi-tenant isolation enforced
/// by Row-Level Security policies. Each company has a unique VAT ID and can
/// have multiple user members with different roles.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyRecord {
    pub id: Uuid,
    pub name: String,
    pub vat_id: String,
    pub email: String,
    pub phone: Option<String>,
    /// JSONB address structure allowing flexible international formats.
    /// Expected keys: street, city, postal_code, country, state, line1, line2
    pub address: Option<JsonValue>,
    /// Path reference to logo file in Supabase Storage (company-logos bucket)
    pub logo_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Row representation of the `profiles` table in Supabase PostgreSQL.
///
/// Extends auth.users with application-specific metadata. Profiles are
/// automatically created by database trigger on user signup. The id field
/// is a foreign key to auth.users(id) with CASCADE delete.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileRecord {
    /// Primary key and foreign key to auth.users(id)
    pub id: Uuid,
    pub full_name: Option<String>,
    /// Path reference to avatar file in Supabase Storage (user-avatars bucket)
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Member role within a company.
///
/// Determines permissions for company operations:
/// - `Owner`: Full control, can delete company, manage all members
/// - `Admin`: Can manage members and update company settings
/// - `Member`: Standard user with read access only
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MemberRole {
    Owner,
    Admin,
    Member,
}

/// Row representation of the `company_members` junction table.
///
/// Manages many-to-many relationships between users and companies with
/// role-based access control. Unique constraint on (company_id, user_id)
/// ensures no duplicate memberships.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyMemberRecord {
    pub id: Uuid,
    pub company_id: Uuid,
    pub user_id: Uuid,
    pub role: MemberRole,
    /// User who invited this member (NULL for self-registration)
    pub invited_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// DTO Types (Data Transfer Objects for IPC)
// ============================================================================

/// DTO for company data transferred across IPC boundary.
///
/// Converts native Rust types (Uuid, DateTime) to String for JSON serialization.
/// Used as return type for Tauri commands querying company data.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyDto {
    pub id: String,
    pub name: String,
    pub vat_id: String,
    pub email: String,
    pub phone: Option<String>,
    pub address: Option<JsonValue>,
    pub logo_url: Option<String>,
    /// ISO 8601 timestamp string (RFC 3339 format)
    pub created_at: String,
    /// ISO 8601 timestamp string (RFC 3339 format)
    pub updated_at: String,
}

/// DTO for profile data transferred across IPC boundary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileDto {
    pub id: String,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
    /// ISO 8601 timestamp string (RFC 3339 format)
    pub created_at: String,
    /// ISO 8601 timestamp string (RFC 3339 format)
    pub updated_at: String,
}

/// DTO for company member data transferred across IPC boundary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyMemberDto {
    pub id: String,
    pub company_id: String,
    pub user_id: String,
    pub role: MemberRole,
    pub invited_by: Option<String>,
    /// ISO 8601 timestamp string (RFC 3339 format)
    pub created_at: String,
    /// ISO 8601 timestamp string (RFC 3339 format)
    pub updated_at: String,
}

// ============================================================================
// Conversion Traits: Record -> DTO
// ============================================================================

impl From<CompanyRecord> for CompanyDto {
    fn from(record: CompanyRecord) -> Self {
        Self {
            id: record.id.to_string(),
            name: record.name,
            vat_id: record.vat_id,
            email: record.email,
            phone: record.phone,
            address: record.address,
            logo_url: record.logo_url,
            created_at: record.created_at.to_rfc3339(),
            updated_at: record.updated_at.to_rfc3339(),
        }
    }
}

impl From<ProfileRecord> for ProfileDto {
    fn from(record: ProfileRecord) -> Self {
        Self {
            id: record.id.to_string(),
            full_name: record.full_name,
            avatar_url: record.avatar_url,
            created_at: record.created_at.to_rfc3339(),
            updated_at: record.updated_at.to_rfc3339(),
        }
    }
}

impl From<CompanyMemberRecord> for CompanyMemberDto {
    fn from(record: CompanyMemberRecord) -> Self {
        Self {
            id: record.id.to_string(),
            company_id: record.company_id.to_string(),
            user_id: record.user_id.to_string(),
            role: record.role,
            invited_by: record.invited_by.map(|uuid| uuid.to_string()),
            created_at: record.created_at.to_rfc3339(),
            updated_at: record.updated_at.to_rfc3339(),
        }
    }
}

// ============================================================================
// Payload Types (Input for IPC Commands)
// ============================================================================

/// Payload for creating a new company.
///
/// Used as input to `create_company` IPC command. The VAT ID must be unique
/// across all companies (enforced by database unique constraint).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyCreatePayload {
    pub name: String,
    pub vat_id: String,
    pub email: String,
    pub phone: Option<String>,
    pub address: Option<JsonValue>,
}

/// Payload for updating an existing company.
///
/// Used as input to `update_company` IPC command. All fields except `id`
/// are optional, allowing partial updates. RLS policies ensure only
/// owners and admins can update companies.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyUpdatePayload {
    pub id: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<Option<String>>,
    pub address: Option<Option<JsonValue>>,
    pub logo_url: Option<Option<String>>,
}

/// Payload for updating a user profile.
///
/// Used as input to `update_profile` IPC command. Profiles are auto-created
/// by database trigger, so only updates are exposed. RLS policies ensure
/// users can only update their own profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileUpdatePayload {
    pub id: String,
    pub full_name: Option<Option<String>>,
    pub avatar_url: Option<Option<String>>,
}

/// Payload for inviting a new member to a company.
///
/// Used as input to `invite_company_member` IPC command. RLS policies
/// ensure only owners and admins can invite members.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InviteMemberPayload {
    pub company_id: String,
    pub user_id: String,
    pub role: MemberRole,
}

/// Payload for updating a member's role within a company.
///
/// Used as input to `update_member_role` IPC command. RLS policies
/// ensure only owners can change member roles.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMemberRolePayload {
    pub member_id: String,
    pub new_role: MemberRole,
}

/// Payload for removing a member from a company.
///
/// Used as input to `remove_company_member` IPC command. RLS policies
/// allow users to remove themselves or owners/admins to remove others.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveMemberPayload {
    pub member_id: String,
    pub company_id: String,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use serde_json::json;

    #[test]
    fn test_company_record_to_dto_conversion() {
        let record = CompanyRecord {
            id: Uuid::new_v4(),
            name: "Test Company".to_string(),
            vat_id: "US123456789".to_string(),
            email: "test@example.com".to_string(),
            phone: Some("+1234567890".to_string()),
            address: Some(json!({
                "street": "123 Main St",
                "city": "City",
                "postal_code": "12345",
                "country": "US"
            })),
            logo_url: Some("logos/test.png".to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let dto: CompanyDto = record.clone().into();

        assert_eq!(dto.id, record.id.to_string());
        assert_eq!(dto.name, record.name);
        assert_eq!(dto.vat_id, record.vat_id);
        assert_eq!(dto.email, record.email);
        assert_eq!(dto.phone, record.phone);
        assert_eq!(dto.address, record.address);
        assert_eq!(dto.logo_url, record.logo_url);
    }

    #[test]
    fn test_profile_record_to_dto_conversion() {
        let record = ProfileRecord {
            id: Uuid::new_v4(),
            full_name: Some("John Doe".to_string()),
            avatar_url: Some("avatars/john.png".to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let dto: ProfileDto = record.clone().into();

        assert_eq!(dto.id, record.id.to_string());
        assert_eq!(dto.full_name, record.full_name);
        assert_eq!(dto.avatar_url, record.avatar_url);
    }

    #[test]
    fn test_company_member_record_to_dto_conversion() {
        let inviter_id = Uuid::new_v4();
        let record = CompanyMemberRecord {
            id: Uuid::new_v4(),
            company_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            role: MemberRole::Admin,
            invited_by: Some(inviter_id),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let dto: CompanyMemberDto = record.clone().into();

        assert_eq!(dto.id, record.id.to_string());
        assert_eq!(dto.company_id, record.company_id.to_string());
        assert_eq!(dto.user_id, record.user_id.to_string());
        assert_eq!(dto.role, record.role);
        assert_eq!(dto.invited_by, Some(inviter_id.to_string()));
    }

    #[test]
    fn test_member_role_serialization() {
        // Test lowercase serialization
        let owner = MemberRole::Owner;
        let admin = MemberRole::Admin;
        let member = MemberRole::Member;

        let owner_json = serde_json::to_string(&owner).unwrap();
        let admin_json = serde_json::to_string(&admin).unwrap();
        let member_json = serde_json::to_string(&member).unwrap();

        assert_eq!(owner_json, r#""owner""#);
        assert_eq!(admin_json, r#""admin""#);
        assert_eq!(member_json, r#""member""#);

        // Test deserialization
        let owner_parsed: MemberRole = serde_json::from_str(&owner_json).unwrap();
        let admin_parsed: MemberRole = serde_json::from_str(&admin_json).unwrap();
        let member_parsed: MemberRole = serde_json::from_str(&member_json).unwrap();

        assert_eq!(owner_parsed, MemberRole::Owner);
        assert_eq!(admin_parsed, MemberRole::Admin);
        assert_eq!(member_parsed, MemberRole::Member);
    }

    #[test]
    fn test_payload_deserialization() {
        let json = r#"{
            "name": "Test Company",
            "vat_id": "US123456789",
            "email": "test@example.com",
            "phone": "+1234567890",
            "address": {
                "street": "123 Main St",
                "city": "City"
            }
        }"#;

        let payload: CompanyCreatePayload = serde_json::from_str(json).unwrap();

        assert_eq!(payload.name, "Test Company");
        assert_eq!(payload.vat_id, "US123456789");
        assert_eq!(payload.email, "test@example.com");
        assert_eq!(payload.phone, Some("+1234567890".to_string()));
        assert!(payload.address.is_some());
    }
}
