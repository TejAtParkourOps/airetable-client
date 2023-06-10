const errors = {
  "not-connected": Error(
    "The socket is not connected. Please call connect() function first."
  ),
} as const;

export default errors;
