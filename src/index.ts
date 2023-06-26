import {
  Base,
  Change,
  ChangeType,
  CreateProjectRequest,
  CreateProjectResponse,
  DeleteProjectRequest,
  DeleteProjectResponse,
  ResourceAddressType,
  StartSyncBaseRequest,
  StartSyncBaseResponse,
  SyncNotification,
  UpdateProjectRequest,
  UpdateProjectResponse,
} from "@parkour-ops/airetable-contract";
import { ClientSideSocket } from "./client-side-socket";
import errors from "./airetable-client-errors";
import { AuthToken } from "./common";

export type DataCallback = (base: Base) => void;
export type DeltaCallback = (notification: SyncNotification) => void;
export type SyncOptions = {
  dataCallback?: {
    onlyOnce?: true
  },
  debugging?: {
    verbose?: true
  }
}

export class AiretableClient {
  readonly #address;
  readonly #client;
  #lastProcessedPayloadNumber = 0;

  #_base: Base | null = null;
  constructor(serverAddress: string, authToken: AuthToken) {
    this.#address = serverAddress;
    this.#client = new ClientSideSocket(serverAddress, { authToken });
  }

  async startSync(
    projectId: string,
    dataCallback: DataCallback,
    deltaCallback?: DeltaCallback,
    options?: SyncOptions
  ) {
    await this.#client.connect();
    // get initial base & callback
    this.#_base = await this.#client.sendRequest<
      StartSyncBaseRequest,
      StartSyncBaseResponse
    >("base-sync:create", {
      projectId,
    });
    dataCallback(this.#_base);
    // subscribe to changes
    this.#client.subscribeToEvent<SyncNotification>(
      `${this.#_base.id}:changed`,
      (msg) => {
        // console.debug("Processing payload:", JSON.stringify(msg));
        if (msg.number <= this.#lastProcessedPayloadNumber) {
          return;
        }
        // update number to prevent processing of duplicate messages
        this.#lastProcessedPayloadNumber = msg.number;
        // affect the base
        for (const c of msg.changes) {
          if (options?.debugging?.verbose) {
            console.debug({
              change: c,
              msgNumber: msg.number,
              msgTimestamp: msg.timestamp
            });
          }
          this.#affectBase(c);
        }
        // execute callbacks
        if (this.#_base && !options?.dataCallback?.onlyOnce) {
          dataCallback(this.#_base);
        } 
        if (deltaCallback) {
          deltaCallback(msg);
        }
      }
    );
  }

  #affectBase<T extends ChangeType, U extends ResourceAddressType>(change: Change<T, U>) {
    // ignore if base is not ready.
    if (!this.#_base) return;
    // CREATION EVENTS
    if (change.type === 'create' && change.resourceAddress.is === "base") {
      // do nothing, this SHOULD be an impossible case
      // since notifications are generated via webhook
      // associated with *this* particular base.
    } else if (change.type === 'create' && change.resourceAddress.is === "table") {
      const c = change as Change<'create', 'table'>;
      this.#_base.tables[c.data.id] = c.data;
    } else if (change.type === 'create' && change.resourceAddress.is === "field") {
      const c = change as Change<'create', 'field'>;
      this.#_base.tables[c.resourceAddress.tableId].fields[c.data.id] = c.data;
    } else if (change.type === 'create' && change.resourceAddress.is === "record") {
      const c = change as Change<'create', 'record'>;
      this.#_base.tables[c.resourceAddress.tableId].records[c.data.id] = c.data;
    } 
    // UPDATE EVENTS
    else if (change.type === "update" && change.resourceAddress.is === "base") {
      const c = change as Change<'update', 'base'>;
      if (c.data.name) {
        this.#_base.name = c.data.name;
      }
    } else if (change.type === "update" && change.resourceAddress.is === "table") {
      const c = change as Change<'update', 'table'>;
      if (c.data.name) {
        this.#_base.tables[c.data.id].name = c.data.name;
      }
      if (c.data.description) {
        this.#_base.tables[c.data.id].description = c.data.description;
      }
    } else if (change.type === "update" && change.resourceAddress.is === "field") {
      const c = change as Change<'update', 'field'>;
      if (c.data.name) {
        this.#_base.tables[c.resourceAddress.tableId].fields[c.data.id].name = c.data.name;
      }
      if (c.data.description) {
        this.#_base.tables[c.resourceAddress.tableId].fields[c.data.id].description = c.data.description;
      }
      if (c.data.type) {
        this.#_base.tables[c.resourceAddress.tableId].fields[c.data.id].type = c.data.type;
        // this requires field options to be updated, this is only available via fresh sync
        this.#forceBaseResync();
      }
    } else if (change.type === "update" && change.resourceAddress.is === "record") {
      const c = change as Change<'update', 'record'>;
      if (!c.data.cells) return;
      for (const [_cellKey, _cellVal] of Object.entries(c.data.cells)) {
        this.#_base.tables[c.resourceAddress.tableId].records[c.data.id].cells[_cellKey] = _cellVal;
      }
    // DELETE EVENTS
    } else if (change.type === "delete" && change.resourceAddress.is === "base") {
      const c = change as Change<'delete', 'base'>;
      this.#_base = null;
    } else if (change.type === "delete" && change.resourceAddress.is === "table") {
      const c = change as Change<'delete', 'table'>;
      delete this.#_base.tables[c.resourceAddress.tableId];
    } else if (change.type === "delete" && change.resourceAddress.is === "field") { 
      const c = change as Change<'delete', 'field'>;
      delete this.#_base.tables[c.resourceAddress.tableId].fields[c.resourceAddress.fieldId];
    } else if (change.type === "delete" && change.resourceAddress.is === "record") { 
      const c = change as Change<'delete', 'record'>;
      delete this.#_base.tables[c.resourceAddress.tableId].records[c.resourceAddress.recordId];
    } else {
      console.warn("Unrecognized sync notification!", change)
    }
  } 

  #forceBaseResync() {
    console.warn("forceBaseResync is unimplemented!");
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
