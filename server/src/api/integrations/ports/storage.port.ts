export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface UploadObjectInput {
  buffer: Buffer;
  contentType: string;
  /** Logical object key / public_id stem (e.g. `events/{uuid}`). */
  path: string;
}

export interface UploadObjectResult {
  url: string;
}

export interface StoragePort {
  upload(input: UploadObjectInput): Promise<UploadObjectResult>;
}
