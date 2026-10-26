import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { baseName } from "@/lib/format";
import { MediaPanel, MediaControls } from "@/components/mediaPanel";
import { getJob, Job, Chapter } from "@/lib/api";
import { SymbolView } from "expo-symbols";

const ITEM_GAP = 8;

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [activeEnd, setActiveEnd] = useState<number | null>(null);

  const mediaRef = useRef<MediaControls>(null);
  const seekGuard = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const title = job ? baseName(job.filename) : "Summary";

  useEffect(() => {
    getJob(id).then(setJob);
  }, [id]);

  useEffect(() => {
    if (Date.now() - seekGuard.current < 600) return;
    if (activeEnd !== null && currentTime >= activeEnd) {
      mediaRef.current?.pause();
      setActiveEnd(null);
    }
  }, [currentTime]);

  function togglePlayAll() {
    setActiveIdx(null);
    setActiveEnd(null);
    playing ? mediaRef.current?.pause() : mediaRef.current?.play();
  }

  function playChapter(c: Chapter) {
    if (activeIdx === c.index && playing) {
      mediaRef.current?.pause();
      return;
    }
    seekGuard.current = Date.now();
    mediaRef.current?.seekTo(c.start);
    setActiveIdx(c.index);
    setActiveEnd(c.end);
    mediaRef.current?.play();
  }

  if (!job) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.content}>
      <MediaPanel
        ref={mediaRef}
        job={job}
        onTime={setCurrentTime}
        onPlaying={setPlaying}
      />
      <Text style={styles.title}>{title}</Text>
      <View>
        <Text style={styles.tldrTitle}>Summary:</Text>
        <Text style={styles.tldr}>{job.result?.tldr}</Text>
      </View>

      <Pressable style={styles.playAll} onPress={togglePlayAll}>
        <SymbolView
          name={{
            ios: playing && activeIdx === null ? "pause.fill" : "play.fill",
            android: playing && activeIdx === null ? "pause" : "play_arrow",
            web: playing && activeIdx === null ? "pause" : "play_arrow",
          }}
          tintColor="#fff"
          size={20}
        />
        <Text style={styles.playAllText}>
          {formatTime(currentTime)} / {formatTime(job.result?.duration ?? 0)}
        </Text>
      </Pressable>
      <ScrollView
        style={styles.recentScroll}
        contentContainerStyle={styles.recentContainer}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {job.result?.chapters.map((c) => {
          const active = activeIdx === c.index;
          return (
            <Pressable
              key={c.index}
              style={[styles.chapter, active && styles.chapterActive]}
              onPress={() => playChapter(c)}
            >
              <View style={styles.ts}>
                <Text style={styles.tsText}>{formatTime(c.start)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chTitle}>{c.title}</Text>
                <Text style={styles.chSummary}>{c.summary}</Text>
              </View>
              <SymbolView
                name={{
                  ios:
                    active && playing
                      ? "pause.circle.fill"
                      : "play.circle.fill",
                  android: active && playing ? "pause_circle" : "play_circle",
                  web: active && playing ? "pause_circle" : "play_circle",
                }}
                tintColor="#009ee8"
                size={28}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: "#fff", fontSize: 20, lineHeight: 23, fontWeight: "bold" },
  content: { flex: 1, padding: 16, gap: 12, paddingTop: 40 },
  tldrTitle: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 23,
    fontWeight: "bold",
  },
  tldr: { color: "#fff", fontSize: 12, lineHeight: 23 },
  playAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#009ee8",
    borderRadius: 12,
    paddingVertical: 12,
  },
  playAllText: { color: "#fff", fontWeight: "600" },
  chapter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#3a3a3a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },

  recentScroll: { flex: 1 },
  recentContainer: { gap: ITEM_GAP, paddingBottom: 24 },
  chapterActive: { borderColor: "#009ee8" },
  ts: {
    backgroundColor: "#6162634a",
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 56,
    alignItems: "center",
  },
  tsText: { color: "#fff", fontWeight: "500" },
  chTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  chSummary: { color: "#ccc", fontSize: 13, marginTop: 2 },
});
