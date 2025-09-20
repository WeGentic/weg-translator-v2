use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use serde::Serialize;
use uuid::Uuid;

use super::dto::{StoredTranslationJob, TranslationRequest, TranslationStage};

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

    pub fn hydrate_from_records(&self, jobs: &[StoredTranslationJob]) {
        if let Ok(mut map) = self.inner.lock() {
            for job in jobs {
                if matches!(job.status.as_str(), "queued" | "running") {
                    let request = TranslationRequest {
                        source_language: job.source_language.clone(),
                        target_language: job.target_language.clone(),
                        text: job.input_text.clone(),
                        metadata: job.metadata.clone(),
                    };

                    let record = JobRecord {
                        job_id: job.job_id,
                        request,
                        stage: job.stage.clone(),
                        progress: job.progress,
                    };

                    map.insert(job.job_id, record);
                }
            }
        }
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
