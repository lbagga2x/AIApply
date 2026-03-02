import { getAuthToken } from "./auth";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// --- CV ---
export async function getUploadUrl(fileName: string, fileType: string) {
  return apiFetch("/api/upload-url", {
    method: "POST",
    body: JSON.stringify({ fileName, fileType }),
  });
}

export async function uploadFileToS3(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) throw new Error("S3 upload failed");
}

export async function getProfile() {
  return apiFetch("/api/profile");
}

// --- Career Goals ---
export async function saveCareerGoals(goals: Record<string, unknown>) {
  return apiFetch("/api/career-goals", {
    method: "POST",
    body: JSON.stringify(goals),
  });
}

export async function getCareerGoals() {
  return apiFetch("/api/career-goals");
}

// --- Applications ---
export async function getApplications() {
  return apiFetch("/api/applications");
}

export async function approveApplication(applicationId: string) {
  return apiFetch("/api/applications/approve", {
    method: "POST",
    body: JSON.stringify({ applicationId }),
  });
}

export async function getTailoredCV(applicationId: string) {
  return apiFetch(`/api/applications/tailored-cv?applicationId=${encodeURIComponent(applicationId)}`);
}

export async function deleteApplication(applicationId: string) {
  return apiFetch(`/api/applications?applicationId=${encodeURIComponent(applicationId)}`, {
    method: "DELETE",
  });
}
