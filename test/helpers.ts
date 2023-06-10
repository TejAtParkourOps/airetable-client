import axios from "axios";

export const firebaseApiKey = process.env?.["FIREBASE_API_KEY"];
if (!firebaseApiKey) {
  throw Error("FIREBASE_API_KEY not defined in env!");
}

export const useProductionUrl =
  process.env?.["USE_PRODUCTION_URL"]?.toLowerCase() === "true" ? true : false;
console.info(`Use production URL? ${useProductionUrl}`);

export const testEmail = "tej+test@parkourops.com";
export const testPassword = "AhrhWl9tarCT1nN1";
export const testProjectId = "***-a-test-project-***";

export async function login(email: string, password: string) {
  const res = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
    {
      email,
      password,
      returnSecureToken: true,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (res.status !== 200) throw Error("Failed to sign in to test account!");

  const tkn = res?.data?.idToken;
  if (!tkn || typeof tkn !== "string")
    throw Error("Failed to retrieve auth token for test account!");

  return tkn as string;
}

export const serverAddress: string = useProductionUrl
  ? "https://parkour-ops-poc.herokuapp.com"
  : "http://0.0.0.0:3434";
