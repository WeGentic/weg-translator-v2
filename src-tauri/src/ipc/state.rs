use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use serde::Serialize;
use uuid::Uuid;

use super::dto::{TranslationRequest, TranslationStage};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobRecord {
    pub job_id: Uuid,
    pub request: TranslationRequest,
    pub stage: TranslationStage,
    pub progress: f32,
}

#[derive(Clone, Default)]
pub struct TranslationState {
    inner: Arc<Mutex<HashMap<Uuid, JobRecord>>>,
}

impl TranslationState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn track_job(&self, job_id: Uuid, request: TranslationRequest) {
        let record = JobRecord {
            job_id,
            request,
            stage: TranslationStage::Received,
            progress: 0.0,
        };
        if let Ok(mut map) = self.inner.lock() {
            map.insert(job_id, record);
        }
    }

    pub fn record_progress(&self, job_id: Uuid, stage: TranslationStage, progress: f32) {
        if let Ok(mut map) = self.inner.lock() {
            if let Some(entry) = map.get_mut(&job_id) {
                entry.stage = stage;
                entry.progress = progress;
            }
        }
    }

    pub fn finish_job(&self, job_id: Uuid) {
        if let Ok(mut map) = self.inner.lock() {
            map.remove(&job_id);
        }
    }

    pub fn snapshot(&self) -> Vec<JobRecord> {
        if let Ok(map) = self.inner.lock() {
            map.values().cloned().collect()
        } else {
            Vec::new()
        }
    }
}
