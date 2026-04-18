export class AppError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ConfigError extends AppError {}
export class InfraError extends AppError {}
export class ReconstructError extends AppError {}
export class ImageGenError extends AppError {}
export class NotionPublishError extends AppError {}
