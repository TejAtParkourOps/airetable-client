import {
  Base,
  CreateProjectRequest,
  CreateProjectResponse,
  DeleteProjectRequest,
  DeleteProjectResponse,
  StartSyncBaseRequest,
  StartSyncBaseResponse,
  SyncNotification,
  UpdateProjectRequest,
  UpdateProjectResponse,
} from "@parkour-ops/airetable-contract";
import { ClientSideSocket } from "./client-side-socket";
import errors from "./airetable-client-errors";

export type AuthToken = string | (() => string);

export class AiretableClient {
  readonly #address;
  readonly #client;
  #lastProcessedPayloadTimestamp = 0;

  #_base: Base | null = null;
  constructor(serverAddress: string, authToken: AuthToken) {
    this.#address = serverAddress;
    this.#client = new ClientSideSocket(serverAddress, { authToken });
  }

  async startSync(projectId: string, onChange: (base: Base) => void) {
    await this.#client.connect();
    // get initial base & callback
    this.#_base = await this.#client.sendRequest<
      StartSyncBaseRequest,
      StartSyncBaseResponse
    >("base-sync:create", {
      projectId,
    });
    onChange(this.#_base);
    // subscribe to changes
    this.#client.subscribeToEvent<SyncNotification>(
      `${this.#_base.id}:changed`,
      (msg) => {
        if (!this.#_base) return;
        console.debug("Processing payload:", JSON.stringify(msg));
        // callback on every change
        // onChange(this.#_base);
      }
    );
  }

  async stopSync() {
    await this.#client.disconnect();
  }

  get base() {
    if (this.#_base) return this.#_base;
    else throw errors["not-initialized"];
  }

  async createProject(data: CreateProjectRequest) {
    await this.#client.connect();
    return await this.#client.sendRequest<
      CreateProjectRequest,
      CreateProjectResponse
    >("project:create", data);
  }

  async updateProject(data: UpdateProjectRequest) {
    await this.#client.connect();
    return await this.#client.sendRequest<
      UpdateProjectRequest,
      UpdateProjectResponse
    >("project:update", data);
  }

  async deleteProject(data: DeleteProjectRequest) {
    await this.#client.connect();
    return await this.#client.sendRequest<
      DeleteProjectRequest,
      DeleteProjectResponse
    >("project:delete", data);
  }
}
