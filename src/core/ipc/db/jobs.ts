/**
 * IPC adapters for job CRUD operations in the new schema.
 */
import {
  JobRecord,
  UpsertJobInput,
  UpdateJobStatusInput,
} from "@/shared/types/database";

import { safeInvoke } from "../request";

type JobDto = JobRecord;

const COMMAND = {
  upsert: "upsert_job_record_v2",
  updateStatus: "update_job_status_v2",
  remove: "delete_job_record_v2",
  listForProject: "list_jobs_for_project_v2",
} as const;

export async function upsertJobRecord(input: UpsertJobInput): Promise<JobRecord> {
  const payload = mapUpsertJobInput(input);
  const dto = await safeInvoke<JobDto>(COMMAND.upsert, { payload });
  return mapJobDto(dto);
}

export async function updateJobStatus(
  input: UpdateJobStatusInput,
): Promise<JobRecord | null> {
  const payload = mapUpdateJobStatusInput(input);
  const dto = await safeInvoke<JobDto | null>(COMMAND.updateStatus, { payload });
  return dto ? mapJobDto(dto) : null;
}

export async function deleteJobRecord(artifactUuid: string, jobType: string): Promise<void> {
  await safeInvoke<void>(COMMAND.remove, {
    artifact_uuid: artifactUuid,
    artifactUuid,
    job_type: jobType,
    jobType,
  });
}

export async function listJobsForProject(projectUuid: string): Promise<JobRecord[]> {
  const dtos = await safeInvoke<JobDto[]>(COMMAND.listForProject, {
    project_uuid: projectUuid,
    projectUuid,
  });
  return dtos.map(mapJobDto);
}

function mapUpsertJobInput(input: UpsertJobInput) {
  return {
    artifactUuid: input.artifactUuid,
    jobType: input.jobType,
    projectUuid: input.projectUuid,
    jobStatus: input.jobStatus,
    errorLog: input.errorLog ?? undefined,
  };
}

function mapUpdateJobStatusInput(input: UpdateJobStatusInput) {
  return {
    artifactUuid: input.artifactUuid,
    jobType: input.jobType,
    jobStatus: input.jobStatus,
    errorLog: input.errorLog ?? undefined,
  };
}

function mapJobDto(dto: JobDto): JobRecord {
  return {
    artifactUuid: dto.artifactUuid,
    jobType: dto.jobType,
    projectUuid: dto.projectUuid,
    jobStatus: dto.jobStatus,
    errorLog: dto.errorLog ?? null,
  };
}
