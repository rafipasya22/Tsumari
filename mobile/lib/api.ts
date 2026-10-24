import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import { Platform } from "react-native";

function getApiUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host) return `http://${host}:8000`;

  return Platform.OS === "android"
    ? "http://10.0.2.2:8000"
    : "http://localhost:8000";
}

const API_URL = getApiUrl();
console.log("API_URL =", API_URL);
export const audioUrl = (id: string) => `${API_URL}/jobs/${id}/audio`;

export type JobStatus = "queued" | "running" | "done" | "failed";
export type Chapter = {
  index: number;
  start: number;
  end: number;
  title: string;
  summary: string;
};
export type JobResult = { tldr: string; chapters: Chapter[]; duration: number };

export type Job = {
  id: string;
  status: JobStatus;
  stage: string | null;
  progress: number;
  filename: string | null;
  error: string | null;
  result: JobResult | null;
};

export async function upload(
  file: { uri: string; name: string; mimeType?: string },
  language?: string,
) {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : ".mp3";
  const dest = FileSystem.documentDirectory + `upload${ext}`;
  console.log("1. copying", file.uri, "->", dest);

  try {
    await FileSystem.copyAsync({ from: file.uri, to: dest });
    console.log("2. copy ok", await FileSystem.getInfoAsync(dest));
  } catch (e) {
    console.log("COPY FAILED:", e);
    throw e;
  }

  try {
    const res = await FileSystem.uploadAsync(`${API_URL}/jobs`, dest, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: file.mimeType ?? "audio/mpeg",
      parameters: {
        filename: file.name,
        ...(language ? { language } : {}),
      },
    });
    console.log("3. response", res.status, res.body);
    if (res.status !== 202) {
      throw new Error(
        JSON.parse(res.body)?.detail ?? `Upload failed (${res.status})`,
      );
    }
    return JSON.parse(res.body) as { id: string; status: JobStatus };
  } catch (e) {
    console.log("UPLOAD FAILED:", e);
    throw e;
  }
}

export async function getJob(id: string) {
  const res = await fetch(`${API_URL}/jobs/${id}`);
  if (!res.ok) {
    throw new Error("Failed getting job");
  }

  return (await res.json()) as Job;
}

export async function listJobs(
  status?: JobStatus[],
  limit = 20,
): Promise<Job[]> {
  const qs = [
    ...(status ?? []).map((s) => `status=${s}`),
    `limit=${limit}`,
  ].join("&");
  const res = await fetch(`${API_URL}/jobs?${qs}`);
  if (!res.ok) throw new Error(`Failed to load jobs (${res.status})`);
  return res.json();
}
