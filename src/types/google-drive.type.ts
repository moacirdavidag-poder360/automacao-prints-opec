import { drive_v3 } from "googleapis";

export interface IFindOrCreateFolderParams {
  drive: drive_v3.Drive;
  name: string;
  parentId?: string;
}

export type IFindOrCreateFolderResponse = string;

export interface IUploadFileToDriveParams {
  filePath: string;
  poNumber: string;
}

export type IUploadFileToDriveResponse = drive_v3.Schema$File | undefined;
