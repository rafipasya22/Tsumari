import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
  TextInput,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
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
import { useRouter } from "expo-router";
import { upload, uploadLink, getJob, Job } from "@/lib/api";

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
  const [optionsUp, setOptions] = useState(false);
  const optionsProg = useSharedValue(0);
  const langProgress = useSharedValue(0);
  const router = useRouter();

  const [mode, setMode] = useState<"File" | "Link">("File");
  const [link, setLink] = useState("");

  const linkValid = YT_RE.test(link.trim());
  const canSubmit = mode === "File" ? !!asset : linkValid;

  const player = useAudioPlayer(asset?.uri ?? null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    langProgress.value = withTiming(langOpen ? 1 : 0, { duration: 250 });
  }, [langOpen]);

  useEffect(() => {
    optionsProg.value = withTiming(optionsUp ? 1 : 0, { duration: 250 });
  }, [optionsUp]);

  const optionsStyle = useAnimatedStyle(() => ({
    height: langProgress.value * LANGS.length * OPTION_H,
  }));
  const modeOptionsStyle = useAnimatedStyle(() => ({
    height: optionsProg.value * LANGS.length * OPTION_H,
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
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const { id } =
        mode === "File" ? await upload(asset!) : await uploadLink(link.trim());
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

  useEffect(() => {
    if (job?.status !== "done" || !jobId) return;
    router.push({ pathname: "/summary/[id]", params: { id: jobId } });
    setAsset(null);
    setJobId(null);
    setJob(null);
  }, [job?.status]);

  return (
    <View style={styles.screen}>
      <View style={styles.uploadContainer}>
        {mode === "File" ? (
          <>
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
                  {asset ? asset.name : "No fjle selected"}
                </Text>
                <View style={styles.audioDetails}>
                  <Text style={styles.conSecondary}>
                    {formatDuration(status.duration)}
                  </Text>
                  <Text style={styles.conSecondary}>•</Text>
                  <Text style={styles.conSecondary}>
                    {formatType(asset?.name)}
                  </Text>
                  <Text style={styles.conSecondary}>•</Text>
                  <Text style={styles.conSecondary}>
                    {formatSize(asset?.size)}
                  </Text>
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
                  {asset ? "Change File" : "Pick File"}
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
          </>
        ) : (
          <>
            <TextInput
              style={styles.linkInput}
              value={link}
              onChangeText={setLink}
              placeholder="Paste a YouTube link"
              placeholderTextColor="#9a9a9a"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {link.length > 0 && !linkValid && (
              <Text style={styles.linkError}>
                That doesn't look like a YouTube link.
              </Text>
            )}
          </>
        )}

        <View style={styles.modeOptionsContainer}>
          <Pressable
            style={styles.langRow}
            onPress={() => setOptions((o) => !o)}
          >
            <View style={styles.audioLangLeft}>
              <SymbolView
                name={{
                  ios: "waveform",
                  android: "upload_file",
                  web: "upload_file",
                }}
                tintColor="#ffffff"
                size={25}
                style={{ marginTop: 5 }}
              />
              <Text style={styles.langLeftText}>Upload Type:</Text>
            </View>
            <View style={styles.audioLangRight}>
              <Text style={styles.langLeftText}>{mode}</Text>
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
          <Animated.View style={[styles.modeOptionsWrap, modeOptionsStyle]}>
            {(["File", "Link"] as const).map((m) => (
              <Pressable
                key={m}
                style={[
                  styles.modeButton,
                  mode === m && styles.modeButtonActive,
                ]}
                onPress={() => {
                  setMode(m);
                  setOptions(false);
                }}
              >
                <Text style={styles.buttonText}>
                  {m === "File" ? "File" : "Youtube Link"}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
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
          (!canSubmit || loading) && { opacity: 0.4 },
        ]}
        disabled={!canSubmit || loading}
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
const YT_RE =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/;
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
  modeRow: {
    flexDirection: "row",
    backgroundColor: "#3a3a3a",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  modeButtonActive: { backgroundColor: "#212121" },
  linkContainer: {
    backgroundColor: "#3a3a3a",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 20,
    gap: 10,
  },
  linkInput: {
    backgroundColor: "#4a4a4a",
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    color: "#ffffff",
    fontSize: 15,
  },
  linkError: { color: "#ff6b6b", fontSize: 12 },
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
  modeOptionsContainer: {
    borderRadius: 15,
    paddingHorizontal: 5,
    marginTop: 5,
    borderWidth: 2,
    backgroundColor: "#3a3a3a",
    borderColor: "#2a2a2a",
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
  modeOptionsWrap: {
    overflow: "hidden",
    marginHorizontal: -5,
    backgroundColor: "#2a2a2a",
  },
});
