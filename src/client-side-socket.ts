import { io, Socket } from "socket.io-client";
import {
  Response,
  ClientSideResponseReceiptCallback,
} from "@parkour-ops/airetable-contract";
import errors from "./client-side-socket-errors";

export type EventMessageHandler<TEventMessage> = (msg: TEventMessage) => void;
export type AuthToken = string | (() => string);

interface Options {
  authToken: AuthToken;
}

export class ClientSideSocket {
  readonly #serverAddr: string;
  readonly #client: Socket;
  readonly #options: Options;
  constructor(serverAddress: string, options: Options) {
    this.#serverAddr = serverAddress;
    this.#options = options;
    // initialise client
    this.#client = io(this.#serverAddr, {
      autoConnect: false, // use implemented connect() method!
    });
    this.#client.on("connect", () => {
      console.debug("Connected to server.");
    });
    this.#client.on("connect_error", (error: Error) => {
      console.error("Error connecting to server:", error.message);
    });
    this.#client.on("disconnect", (reason, description) => {
      if (reason !== "io client disconnect") {
        console.error("Server cut connection!", reason, description);
      }
    });
  }
  async connect() {
    return new Promise<void>((resolve) => {
      if (this.#client.connected) resolve();
      this.#client.connect();
      const n = setInterval(() => {
        if (!this.#client.connected) {
          console.debug("Connecting to server...");
        } else {
          clearInterval(n);
          resolve();
        }
      }, 1000);
    });
  }
  disconnect() {
    return new Promise<void>((resolve) => {
      if (this.#client.disconnected) resolve();
      this.#client.disconnect();
      const n = setInterval(() => {
        if (!this.#client.disconnected) {
          console.debug("Disconnecting from server...");
        } else {
          clearInterval(n);
          resolve();
        }
      }, 1000);
    });
  }
  #assertConnection() {
    if (!this.#client.connected) {
      throw errors["not-connected"];
    }
  }
  sendRequest<TRequest, TResponseData>(
    route: string,
    data: TRequest
  ): Promise<TResponseData> {
    this.#assertConnection();
    return new Promise(async (resolve, reject) => {
      // this.#assertConnection();
      // define callback function
      const callbackFunc: ClientSideResponseReceiptCallback<TResponseData> = (
        response: Response<TResponseData>
      ) => {
        if (!response.isSuccess) {
          reject(response);
        } else {
          resolve(response.data);
        }
      };
      // generate request args, schema: [ authToken (if any), data, callback ]
      const args = [
        // auth token:
        this.#options.authToken,
        // data:
        data ?? null,
        // callback:
        callbackFunc,
      ];
      // send the message
      this.#client.emit(route, ...args);
    });
  }
  subscribeToEvent<TEventMessage>(
    eventPath: string,
    handler: EventMessageHandler<TEventMessage>
  ) {
    this.#client.on(eventPath, (...args: Array<any>) => {
      const msg = args[0] as TEventMessage;
      handler(msg);
    });
  }
}
