export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  fields?: Record<string, string[] | undefined>;

  constructor(message: string, fields?: Record<string, string[] | undefined>) {
    super(message);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = "未授權") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = "權限不足") {
    super(message);
    this.name = "ForbiddenError";
  }
}
