import { initSubagentRegistry, registerSubagentRun } from "openclaw";

export class OrchestratorService {
  constructor() {
    initSubagentRegistry();
  }

  registerRun(params: Parameters<typeof registerSubagentRun>[0]) {
    registerSubagentRun(params);
  }
}
