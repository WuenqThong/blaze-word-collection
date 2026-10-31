import { apiClient } from "./client";

export interface RolePlayScenario {
  id: number;
  project_id: number;
  use_case: string;
  name: string;
  description: string | null;
  instructions: string | null;
  language: string;
  max_tasks_per_user: number;
  max_duration_sec: number;
  is_active: boolean;
  tasks_done: number;
  project_name?: string | null;
  test_case_count: number;
}

export interface RolePlayTestCase {
  id: number;
  scenario_id: number;
  name: string;
  description: string | null;
  instructions: string | null;
  expected_outcome: string | null;
  is_active: boolean;
}

export interface TestCaseCreatePayload {
  name: string;
  description?: string;
  instructions?: string;
  expected_outcome?: string;
  is_active?: boolean;
}
export type TestCaseUpdatePayload = Partial<TestCaseCreatePayload>;

export interface ScenarioCreatePayload {
  use_case: string;
  name: string;
  description?: string;
  instructions?: string;
  max_tasks_per_user?: number;
  max_duration_sec?: number;
  is_active?: boolean;
}
export type ScenarioUpdatePayload = Partial<ScenarioCreatePayload>;

export interface ImportFromAgentResponse {
  imported: number;
  skipped: number;
  items: RolePlayScenario[];
}

export interface AgentUseCase {
  use_case: string;
  name: string;
  description: string;
  instructions: string;
  imported: boolean;
}

export interface TaskStartResponse {
  task_id: number;
  scenario_id: number;
  test_case_id: number | null;
  test_case_name: string | null;
  use_case: string | null;
  language: string;
  max_duration_sec: number;
  instructions: string | null;
  expected_outcome: string | null;
}

export interface RolePlayTask {
  id: number;
  scenario_id: number;
  scenario_name: string;
  test_case_id?: number | null;
  test_case_name?: string | null;
  project_id?: number | null;
  project_name?: string | null;
  user_id: number;
  user_email?: string | null;
  user_full_name?: string | null;
  status: "pending" | "running" | "ended" | "failed";
  client_id?: string | null;
  agent_session_id?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration_sec?: number | null;
  has_recording: boolean;
  has_report: boolean;
  report_data?: Record<string, any> | null;
  report_rating?: number | null;
  report_note?: string | null;
  report_submitted_at?: string | null;
}

export interface TaskListResponse {
  items: RolePlayTask[];
  total: number;
}

export const roleplayApi = {
  // ----- Cross-project user view -----
  async listScenariosForMe(): Promise<RolePlayScenario[]> {
    const { data } = await apiClient.get<RolePlayScenario[]>("/roleplay/scenarios");
    return data;
  },
  async getScenario(id: number): Promise<RolePlayScenario> {
    const { data } = await apiClient.get<RolePlayScenario>(`/roleplay/scenarios/${id}`);
    return data;
  },
  async startTask(scenario_id: number, test_case_id?: number): Promise<TaskStartResponse> {
    const { data } = await apiClient.post<TaskStartResponse>("/roleplay/tasks", { scenario_id, test_case_id });
    return data;
  },
  async listScenarioTestCases(scenario_id: number): Promise<RolePlayTestCase[]> {
    const { data } = await apiClient.get<RolePlayTestCase[]>(`/roleplay/scenarios/${scenario_id}/test-cases`);
    return data;
  },
  async endTask(task_id: number, body: { client_id?: string; error?: string } = {}): Promise<RolePlayTask> {
    const { data } = await apiClient.post<RolePlayTask>(`/roleplay/tasks/${task_id}/end`, body);
    return data;
  },
  async listMyTasks(limit = 50, offset = 0): Promise<TaskListResponse> {
    const { data } = await apiClient.get<TaskListResponse>("/roleplay/tasks/me", { params: { limit, offset } });
    return data;
  },
  async getRecordingUrl(task_id: number): Promise<string> {
    const { data } = await apiClient.get<{ url: string }>(`/roleplay/tasks/${task_id}/recording-url`);
    return data.url;
  },
  async submitReportRating(task_id: number, body: { rating: number; note?: string }): Promise<RolePlayTask> {
    const { data } = await apiClient.post<RolePlayTask>(`/roleplay/tasks/${task_id}/report`, body);
    return data;
  },

  // ----- Project Scenarios (admin + member) -----
  async listProjectScenarios(projectId: number): Promise<RolePlayScenario[]> {
    const { data } = await apiClient.get<RolePlayScenario[]>(`/projects/${projectId}/roleplay/scenarios`);
    return data;
  },
  async createProjectScenario(projectId: number, payload: ScenarioCreatePayload): Promise<RolePlayScenario> {
    const { data } = await apiClient.post<RolePlayScenario>(`/projects/${projectId}/roleplay/scenarios`, payload);
    return data;
  },
  async updateProjectScenario(projectId: number, scenarioId: number, payload: ScenarioUpdatePayload): Promise<RolePlayScenario> {
    const { data } = await apiClient.patch<RolePlayScenario>(`/projects/${projectId}/roleplay/scenarios/${scenarioId}`, payload);
    return data;
  },
  async deleteProjectScenario(projectId: number, scenarioId: number): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/roleplay/scenarios/${scenarioId}`);
  },
  async importScenariosFromAgent(
    projectId: number,
    payload: { overwrite?: boolean } = {},
  ): Promise<ImportFromAgentResponse> {
    const { data } = await apiClient.post<ImportFromAgentResponse>(
      `/projects/${projectId}/roleplay/scenarios/import-from-agent`,
      payload,
    );
    return data;
  },
  // ----- TestCases under scenario (admin) -----
  async listProjectScenarioTestCases(projectId: number, scenarioId: number): Promise<RolePlayTestCase[]> {
    const { data } = await apiClient.get<RolePlayTestCase[]>(
      `/projects/${projectId}/roleplay/scenarios/${scenarioId}/test-cases`,
    );
    return data;
  },
  async createTestCase(projectId: number, scenarioId: number, payload: TestCaseCreatePayload): Promise<RolePlayTestCase> {
    const { data } = await apiClient.post<RolePlayTestCase>(
      `/projects/${projectId}/roleplay/scenarios/${scenarioId}/test-cases`,
      payload,
    );
    return data;
  },
  async updateTestCase(projectId: number, scenarioId: number, testCaseId: number, payload: TestCaseUpdatePayload): Promise<RolePlayTestCase> {
    const { data } = await apiClient.patch<RolePlayTestCase>(
      `/projects/${projectId}/roleplay/scenarios/${scenarioId}/test-cases/${testCaseId}`,
      payload,
    );
    return data;
  },
  async deleteTestCase(projectId: number, scenarioId: number, testCaseId: number): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/roleplay/scenarios/${scenarioId}/test-cases/${testCaseId}`);
  },

  /** Live list use_cases agent hỗ trợ + đánh dấu cái nào đã import. */
  async listAgentUseCases(projectId: number): Promise<AgentUseCase[]> {
    const { data } = await apiClient.get<AgentUseCase[]>(
      `/projects/${projectId}/roleplay/agent-use-cases`,
    );
    return data;
  },
  async listProjectTasks(
    projectId: number,
    params: { scenario_id?: number; user_id?: number; status?: string; limit?: number; offset?: number } = {},
  ): Promise<TaskListResponse> {
    const { data } = await apiClient.get<TaskListResponse>(`/projects/${projectId}/roleplay/tasks`, { params });
    return data;
  },
};
