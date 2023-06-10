const errors = {
  "not-initialized": Error(
    "The base is not initialized. Please call sync(...) function first."
  ),
} as const;

export default errors;
