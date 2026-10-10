import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { upload, getJob, Job } from "@/lib/api";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  button: { backgroundColor: "#02a2e7", padding: 14, borderRadius: 10 },
  buttonText: { color: "white", fontWeight: "600" },
});

export default function ImportScreen() {
  const [asset, setAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(
    null,
  );
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAudio() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: false,
    });
    if (result.canceled) return;
    setAsset(result.assets[0]);
    setJobId(null);
    setJob(null);
    setError(null);
  }

  async function onUpload() {
    if (!asset) return;
    setLoading(true);
    setError(null);
    try {
      const { id } = await upload(asset);
      setJobId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!jobId) return;
    const timer = setInterval(async () => {
      try {
        const job = await getJob(jobId);
        setJob(job);
        if (job.status === "done" || job.status === "failed")
          clearInterval(timer);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Polling Error!");
        clearInterval(timer);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [jobId]);

  return (
    <View style={styles.container}>
      {/* TODO: pick button, selected file name */}
      <Pressable style={styles.button} onPress={pickAudio}>
        <Text style={styles.buttonText}>Pick Audio</Text>
      </Pressable>
      <Pressable
        style={[styles.button, (!asset || loading) && { opacity: 0.4 }]}
        disabled={!asset || loading}
        onPress={onUpload}
      >
        <Text style={styles.buttonText}>
          {loading ? "Uploading..." : "Upload"}
        </Text>
      </Pressable>

      {asset && <Text>Selected: {asset.name}</Text>}
      {loading && <Text>Uploading...</Text>}
      {error && <Text style={{ color: "red" }}>{error}</Text>}
      {jobId && !job && <Text>Uploaded, waiting for worker...</Text>}
      {job && job.status !== "done" && job.status !== "failed" && (
        <Text>
          {job.stage ?? "queued"} · {Math.round(job.progress * 100)}%
        </Text>
      )}
      {job?.status === "failed" && <Text>{job.error}</Text>}
      {job?.status === "done" && <Text>{job.result?.tldr}</Text>}
    </View>
  );
}
