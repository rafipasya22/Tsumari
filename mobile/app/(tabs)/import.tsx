import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { upload, getJob, Job } from "@/lib/api";
import Animated, {
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolation,
  SharedValue,
} from "react-native-reanimated";
import { SymbolView } from "expo-symbols";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

export default function ImportScreen() {
  const [asset, setAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(
    null,
  );
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const LANGS = ["Auto-detect", "English", "Indonesian"];
  const [lang, setLang] = useState("Auto-detect");
  const [langOpen, setLangOpen] = useState(false);
  const langProgress = useSharedValue(0);

  const player = useAudioPlayer(asset?.uri ?? null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    langProgress.value = withTiming(langOpen ? 1 : 0, { duration: 250 });
  }, [langOpen]);

  const optionsStyle = useAnimatedStyle(() => ({
    height: langProgress.value * LANGS.length * OPTION_H,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${langProgress.value * 180}deg` }],
  }));

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
    <View style={styles.screen}>
      <View style={styles.uploadContainer}>
        <View style={styles.audioInfoContainer}>
          <View style={styles.audioIcon}>
            <SymbolView
              name={{
                ios: "waveform",
                android: "graphic_eq",
                web: "graphic_eq",
              }}
              tintColor="#00567b"
              size={30}
            />
          </View>
          <View style={styles.audioInfo}>
            <Text style={styles.audioTitle} numberOfLines={1}>
              {asset ? asset.name : "No audio selected"}
            </Text>
            <View style={styles.audioDetails}>
              <Text style={styles.conSecondary}>
                {formatDuration(status.duration)}
              </Text>
              <Text style={styles.conSecondary}>•</Text>
              <Text style={styles.conSecondary}>{formatType(asset?.name)}</Text>
              <Text style={styles.conSecondary}>•</Text>
              <Text style={styles.conSecondary}>{formatSize(asset?.size)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.buttonsContainer}>
          <Pressable style={styles.audioPickButton} onPress={pickAudio}>
            <SymbolView
              name={
                asset
                  ? {
                      ios: "arrow.clockwise",
                      android: "refresh",
                      web: "refresh",
                    }
                  : {
                      ios: "square.and.arrow.up",
                      android: "upload",
                      web: "upload",
                    }
              }
              tintColor="#ffffff"
              size={22}
              style={{ marginTop: 2 }}
            />
            <Text style={styles.buttonText}>
              {asset ? "Change Audio" : "Pick Audio"}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.cancelButton,
              (!asset || loading) && { opacity: 0.4 },
            ]}
            disabled={!asset || loading}
            onPress={() => {
              setAsset(null);
              setJobId(null);
              setJob(null);
              setError(null);
            }}
          >
            <SymbolView
              name={{
                ios: "waveform",
                android: "cancel",
                web: "cancel",
              }}
              tintColor="#c80000"
              size={24}
            />
          </Pressable>
        </View>
      </View>
      <View style={styles.audioLangContainer}>
        <Pressable
          style={styles.langRow}
          onPress={() => setLangOpen((o) => !o)}
        >
          <View style={styles.audioLangLeft}>
            <SymbolView
              name={{
                ios: "waveform",
                android: "language",
                web: "graphic_eq",
              }}
              tintColor="#ffffff"
              size={25}
              style={{ marginTop: 5 }}
            />
            <Text style={styles.langLeftText}>Language</Text>
          </View>
          <View style={styles.audioLangRight}>
            <Text style={styles.langLeftText}>{lang}</Text>
            <Animated.View style={chevronStyle}>
              <SymbolView
                name={{
                  ios: "chevron.down",
                  android: "expand_more",
                  web: "expand_more",
                }}
                tintColor="#fff"
                size={16}
                style={{ marginTop: 3 }}
              />
            </Animated.View>
          </View>
        </Pressable>
        <Animated.View style={[styles.optionsWrap, optionsStyle]}>
          {LANGS.map((l) => (
            <Pressable
              key={l}
              style={styles.langOption}
              onPress={() => {
                setLang(l);
                setLangOpen(false);
              }}
            >
              <Text style={styles.langLeftText}>{l}</Text>
            </Pressable>
          ))}
        </Animated.View>
      </View>

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
      <Pressable
        style={[
          styles.summarizeButton,
          (!asset || loading) && { opacity: 0.4 },
        ]}
        disabled={!asset || loading}
        onPress={onUpload}
      >
        <Text style={styles.buttonText}>
          {loading ? "Summarizing..." : "Summarize Audio"}
        </Text>
      </Pressable>
    </View>
  );
}

const OPTION_H = 40;
function formatSize(bytes?: number) {
  if (!bytes) return "--";
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function formatType(name?: string) {
  const ext = name?.split(".").pop();
  return ext ? ext.toUpperCase() : "--";
}

function formatDuration(sec?: number) {
  if (!sec) return "--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m >= 60
    ? `${Math.floor(m / 60)}h ${m % 60}m`
    : m > 0
      ? `${m} min`
      : `${s} sec`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  screen: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  uploadContainer: {
    paddingHorizontal: 15,
    paddingVertical: 20,
    backgroundColor: "#3a3a3a",
    borderRadius: 10,
    gap: 15,
  },
  audioInfoContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 12,
  },
  conSecondary: {
    fontSize: 10,
    fontWeight: "500",
    color: "#ffffff",
  },
  audioIcon: {
    width: 50,
    height: 50,
    borderRadius: 11,
    backgroundColor: "#009ee8",
    alignItems: "center",
    paddingLeft: 5,
    paddingTop: 5,
    justifyContent: "center",
  },
  audioInfo: {
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    flex: 1,
  },
  audioDetails: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
  },
  audioTitle: { color: "#ffffff", fontSize: 20, fontWeight: "600" },
  buttonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  audioPickButton: {
    backgroundColor: "#6d6b6b",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 3,
    flex: 1,
    height: 40,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  summarizeButton: {
    backgroundColor: "#6d6b6b",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 3,
    height: 40,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: "auto",
    marginBottom: 100,
  },
  cancelButton: {
    backgroundColor: "#6d6b6b",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    width: 40,
    height: 40,
    paddingLeft: 5,
    paddingTop: 5,
  },
  buttonText: { color: "white", fontWeight: "600" },
  audioLangContainer: {
    borderRadius: 15,
    paddingHorizontal: 5,
    marginTop: 10,
    borderWidth: 2,
    backgroundColor: "#009ee8",
    overflow: "hidden",
  },
  audioLangLeft: {
    flexDirection: "row",
    paddingLeft: 5,
    gap: 2,
    alignItems: "center",
  },

  langLeftText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  langRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  audioLangRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 8,
  },

  langOption: {
    height: OPTION_H,
    justifyContent: "center",
    paddingHorizontal: 13,
  },
  optionsWrap: {
    overflow: "hidden",
    marginHorizontal: -5,
    backgroundColor: "#0079ad",
  },
});
