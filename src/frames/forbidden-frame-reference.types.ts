export interface ForbiddenFrameUpload {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface ForbiddenFrameReferenceDto {
  id: string;
  label: string;
  thumbnailHash: string;
  previewUrl: string;
  createdAt: string;
  updatedAt: string;
}
