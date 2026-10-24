import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { SymbolView } from "expo-symbols";
import { getJob, audioUrl, Job, Chapter } from "@/lib/api";

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [activeEnd, setActiveEnd] = useState<number | null>(null);

  const player = useAudioPlayer(job ? audioUrl(job.id) : null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    getJob(id).then(setJob);
  }, [id]);

  useEffect(() => {
    if (activeEnd !== null && status.currentTime >= activeEnd) {
      player.pause();
      setActiveEnd(null);
    }
  }, [status.currentTime]);

  function togglePlayAll() {
    setActiveIdx(null);
    setActiveEnd(null);
    status.playing ? player.pause() : player.play();
  }

  async function playChapter(c: Chapter) {
    if (activeIdx === c.index && status.playing) {
      player.pause();
      return;
    }
    await player.seekTo(c.start);
    setActiveIdx(c.index);
    setActiveEnd(c.end);
    player.play();
  }

  if (!job) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.tldr}>{job.result?.tldr}</Text>

      <Pressable style={styles.playAll} onPress={togglePlayAll}>
        <SymbolView
          name={{
            ios: status.playing && activeIdx === null ? "pause.fill" : "play.fill",
            android: status.playing && activeIdx === null ? "pause" : "play_arrow",
            web: status.playing && activeIdx === null ? "pause" : "play_arrow",
          }}
          tintColor="#fff"
          size={20}
        />
        <Text style={styles.playAllText}>
          {formatTime(status.currentTime)} / {formatTime(job.result?.duration ?? 0)}
        </Text>
      </Pressable>

      {job.result?.chapters.map((c) => {
        const active = activeIdx === c.index;
        return (
          <Pressable key={c.index} style={[styles.chapter, active && styles.chapterActive]} onPress={() => playChapter(c)}>
            <View style={styles.ts}>
              <Text style={styles.tsText}>{formatTime(c.start)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chTitle}>{c.title}</Text>
              <Text style={styles.chSummary}>{c.summary}</Text>
            </View>
            <SymbolView
              name={{
                ios: active && status.playing ? "pause.circle.fill" : "play.circle.fill",
                android: active && status.playing ? "pause_circle" : "play_circle",
                web: active && status.playing ? "pause_circle" : "play_circle",
              }}
              tintColor="#009ee8"
              size={28}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  tldr: { color: "#fff", fontSize: 16, lineHeight: 23 },
  playAll: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#009ee8", borderRadius: 12, paddingVertical: 12,
  },
  playAllText: { color: "#fff", fontWeight: "600" },
  chapter: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    backgroundColor: "#3a3a3a", borderRadius: 14, borderWidth: 1, borderColor: "transparent",
  },
  chapterActive: { borderColor: "#009ee8" },
  ts: { backgroundColor: "#6162634a", borderRadius: 10, paddingVertical: 4, paddingHorizontal: 8, minWidth: 56, alignItems: "center" },
  tsText: { color: "#fff", fontWeight: "500" },
  chTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  chSummary: { color: "#ccc", fontSize: 13, marginTop: 2 },
});