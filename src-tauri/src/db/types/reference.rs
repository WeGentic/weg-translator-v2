#![allow(dead_code)]

//! Reference data types (users, clients, domains) persisted in the database.

/// Application user persisted in the reference `users` table.
#[derive(Debug, Clone)]
pub struct User {
    pub user_id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub created_at: String,
}

/// External client entity linked to translation projects.
#[derive(Debug, Clone)]
pub struct Client {
    pub client_id: String,
    pub name: String,
}

/// Domain classification used to categorize projects.
#[derive(Debug, Clone)]
pub struct Domain {
    pub domain_id: String,
    pub name: String,
}
