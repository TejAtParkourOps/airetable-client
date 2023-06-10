import { expect } from "chai";
import { AiretableClient } from "../dist";
import {
  testEmail,
  testPassword,
  serverAddress,
  testProjectId,
  login,
} from "./helpers";

// begin a test suite of one or more tests
describe("Client-side library to access the Airetable service: sync", function () {
  let clientWithCorrectToken: AiretableClient;
  let clientWithIncorrectToken: AiretableClient;
  const c = this.beforeAll(async () => {
    const token = await login(testEmail, testPassword);
    clientWithCorrectToken = new AiretableClient(serverAddress, token);
    clientWithIncorrectToken = new AiretableClient(serverAddress, "zzz");
  });

  it("should return 404 response if the auth token is valid, but project id is invalid.", async function () {
    try {
      await clientWithCorrectToken.startSync(
        "this-project-does-not-exist",
        (base) => {
          // console.debug(base);
        }
      );
    } catch (err: any) {
      expect(err?.statusCode === 404);
    }
  });

  it("should return 401 response if the auth token is not valid, should never read project even if project id is valid.", async function () {
    try {
      await clientWithIncorrectToken.startSync(
        "this-project-does-not-exist",
        (base) => {
          // console.debug(base);
        }
      );
    } catch (err: any) {
      expect(err?.statusCode === 401);
    }
  });

  it("should callback with valid data if both auth token and project id are valid (the 200 response is handled internally).", async function () {
    await clientWithCorrectToken.startSync(testProjectId, (base) => {
      console.debug(JSON.stringify(base));
      expect(base).to.be.an("object");
    });
  });
});
