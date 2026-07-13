export class ScoringFormatError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ScoringFormatError";
    this.code = code;
  }
}
