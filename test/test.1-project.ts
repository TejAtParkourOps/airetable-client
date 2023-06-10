import { expect } from "chai";
import { AiretableClient } from "../dist";
import {
  testEmail,
  testPassword,
  serverAddress,
  testProjectId,
  login,
} from "./helpers";
import { Project } from "@parkour-ops/airetable-contract";

// begin a test suite of one or more tests
describe("Client-side library to access the Airetable service: project", function () {
  let client: AiretableClient;
  const c = this.beforeAll(async () => {
    const token = await login(testEmail, testPassword);
    client = new AiretableClient(serverAddress, token);
  });

  let testProject: Project | undefined = undefined;

  it("project:create", async function () {
    testProject = await client.createProject({
      name: "a-test-project",
      description: "some description here...",
      airtable: {
        personalAccessToken: "invalid-personal-access-token",
        baseId: "invalid-base-id",
      },
    });

    expect(testProject).to.be.an("object");
  });

  it("project:update", async function () {
    if (!testProject) throw Error("Must run createProject(...) first!");

    const id = testProject.id;
    const newName = "a-new-project-name";

    testProject = await client.updateProject({
      id: id,
      name: newName,
    });

    expect(testProject).to.be.an("object");
    expect(testProject.id).to.equal(id);
    expect(testProject.name).to.equal(newName);
  });

  it("project:delete", async function () {
    if (!testProject) throw Error("Must run createProject(...) first!");

    const beforeDelete = Object.assign(testProject);

    testProject = await client.deleteProject({ id: testProject.id });

    expect(testProject).to.be.an("object");
    expect(testProject.id).to.equal(beforeDelete.id);
  });
});
