import {
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from "react-native";
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

import { Text, View } from "@/components/Themed";

const SCREEN_PADDING = 16;
const CARD_GAP = 12;
const PEEK = 28;

const ITEM_HEIGHT = 76;
const ITEM_GAP = 8;
const MAX_VISIBLE = 3;
const LIST_MAX_HEIGHT =
  MAX_VISIBLE * ITEM_HEIGHT + (MAX_VISIBLE - 1) * ITEM_GAP;

const timestamp_height = 34;
const timestamp_gap = 10;
const TS_WIDTH = 56;
const max_visTimestamp = 3;
const list_max_timestampHeights =
  max_visTimestamp * timestamp_height + (max_visTimestamp - 1) * timestamp_gap;

type Job = { id: string; title: string; percent: number; stage: string };

function InProgressCard({ job, width }: { job: Job; width: number }) {
  const fillStyle = useAnimatedStyle(() => ({
    width: withTiming(`${job.percent}%`, { duration: 600 }),
  }));

  return (
    <View style={[styles.progressContainer, { width }]}>
      <View style={styles.progressContainerTop}>
        <Text style={styles.conTitle} numberOfLines={1}>
          {job.title}
        </Text>
        <Text style={styles.conTitle}>{job.percent}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      <Text style={styles.conSecondary}>{job.stage}</Text>
    </View>
  );
}

function Dot({
  index,
  scrollX,
  step,
}: {
  index: number;
  scrollX: SharedValue<number>;
  step: number;
}) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * step, index * step, (index + 1) * step];
    return {
      width: interpolate(scrollX.value, input, [6, 16, 6], Extrapolation.CLAMP),
      opacity: interpolate(
        scrollX.value,
        input,
        [0.3, 1, 0.3],
        Extrapolation.CLAMP,
      ),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

export default function TabOneScreen() {
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });
  const percent = Math.round(45);
  const fillStyle = useAnimatedStyle(() => ({
    width: withTiming(`${percent}%`, { duration: 600 }),
  }));

  const inProgress: Job[] = [
    {
      id: "1",
      title: "Inflation and Interest Rates",
      percent: 45,
      stage: "Transcribing 9/20",
    },
    {
      id: "2",
      title: "Indie Music Podcast #13",
      percent: 80,
      stage: "Chaptering",
    },
    { id: "3", title: "Product Design Talk", percent: 10, stage: "Chunking" },
  ];
  const recent = Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    title: `Sample recording number ${i + 1} with a very long title`,
    duration: "52 min",
    chapters: 6,
  }));
  const timestamps = Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    time: "3:44",
    caps: `Haduh GOBLOGG ke-${i} Haduh GOBLOGG ke-${i}Haduh GOBLOGG ke-${i}Haduh GOBLOGG ke-${i}Haduh GOBLOGG ke-${i}`,
  }));

  const cardWidth = width - SCREEN_PADDING * 2;
  const shown = timestamps.slice(0, max_visTimestamp);
  const remaining = timestamps.length - shown.length;

  return (
    <View style={styles.screen}>
      <View style={styles.titleBar}>
        <Text style={styles.appTitle}>つまり</Text>
      </View>
      <ScrollView
        style={styles.mainContainer}
        contentContainerStyle={styles.mainContent}
      >
        <View style={styles.containerGap}>
          <View style={styles.lastSummaryCon}>
            <View style={styles.lastSummaryTop}>
              <Text style={styles.conSecondary}>Latest Summary</Text>
              <Text style={styles.conSecondary}>•</Text>
              <Text style={styles.conSecondary}>32 Min</Text>
            </View>

            <Text
              numberOfLines={2}
              ellipsizeMode="tail"
              style={styles.lastSummaryTitle}
            >
              Sample recording number 2 with a very long title
            </Text>
            <Text
              numberOfLines={3}
              ellipsizeMode="tail"
              style={styles.lastSummaryOverview}
            >
              Sample recording number 2 with a very long titleSample recording
              number 2 with a very long titleSample recording number 2 with a
              very long titleSample recording number 2 with a very long
              titleSample recording number 2 with a very long titleSample
              recording number 2 with a very long title
            </Text>

            <View
              style={styles.separator}
              lightColor="#eee"
              darkColor="rgb(77, 77, 78)"
            />

            <View style={styles.timestampList}>
              {shown.map((item) => (
                <View key={item.id} style={styles.summaryBottomItems}>
                  <View style={styles.timestamp}>
                    <Text style={styles.conSecondary}>{item.time}</Text>
                  </View>
                  <Text
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    style={styles.conSecondary}
                  >
                    {item.caps}
                  </Text>
                </View>
              ))}
              {remaining > 0 && (
                <Text style={styles.moreChapters}>
                  + {remaining} more chapters
                </Text>
              )}
            </View>
            <View style={styles.bottomSummary}>
              <Pressable style={styles.button}>
                <Text style={styles.buttonText}>Open Summary</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.containerGap}>
          <Text style={styles.title}>In Progress</Text>
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + CARD_GAP}
            disableIntervalMomentum
            decelerationRate="fast"
            contentContainerStyle={styles.progressRow}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {inProgress.map((job) => (
              <InProgressCard key={job.id} job={job} width={cardWidth} />
            ))}
          </Animated.ScrollView>
          {inProgress.length > 1 && (
            <View style={styles.dots}>
              {inProgress.map((j, i) => (
                <Dot
                  key={j.id}
                  index={i}
                  scrollX={scrollX}
                  step={cardWidth + CARD_GAP}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.containerGap}>
          <Text style={styles.title}>Recent</Text>
          <ScrollView
            style={styles.recentScroll}
            contentContainerStyle={styles.recentContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {recent.map((item) => (
              <View key={item.id} style={styles.recentItems}>
                <View style={styles.recentStart}>
                  <View style={styles.recentItemIcons}>
                    <SymbolView
                      name={{
                        ios: "waveform",
                        android: "graphic_eq",
                        web: "graphic_eq",
                      }}
                      tintColor="#00567b"
                      size={24}
                    />
                  </View>
                  <View style={styles.recentMid}>
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={styles.recentTitle}
                    >
                      {item.title}
                    </Text>
                    <View style={styles.recentMidLow}>
                      <Text style={styles.conSecondary}>{item.duration}</Text>
                      <Text style={styles.conSecondary}>•</Text>
                      <Text style={styles.conSecondary}>
                        {item.chapters} chapters
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.recentEnd}>
                  <SymbolView
                    name={{
                      ios: "chevron.right",
                      android: "chevron_right",
                      web: "chevron_right",
                    }}
                    tintColor="#f6f8f8"
                    size={24}
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 40,
  },
  mainContainer: {
    flex: 1,
  },
  mainContent: {
    paddingHorizontal: 16,
    paddingBottom: 85,
  },
  titleBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 10,
  },
  bottomSummary:{
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'transparent'
  },
  appTitle: {
    fontSize: 25,
    fontWeight: "bold",
  },
  containerGap: {
    gap: 12,
    marginBottom: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  conTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  conSecondary: {
    fontSize: 15,
    fontWeight: "500",
  },
  separator: {
    marginVertical: 15,
    height: 2,
  },
  button: {
    backgroundColor: "#ffffff",
    borderRadius: 15,
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 3,
    width: 160,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#282524fc",
    fontSize: 17,
    fontWeight: "600",
  },

  lastSummaryCon: {
    backgroundColor: "#3a3a3a",
    borderColor: "#0607079b",
    borderWidth: 1,
    shadowRadius: 2,
    borderRadius: 15,
    padding: 16,
    flexDirection: "column",
    justifyContent: "flex-start",
  },
  lastSummaryTop: {
    width: 180,
    padding: 7,
    borderRadius: 10,
    backgroundColor: "#009ee8",
    borderColor: "#00344a9b",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginBottom: 12,
  },
  lastSummaryTitle: {
    fontSize: 25,
    fontWeight: "bold",
    marginBottom: 5,
  },
  lastSummaryOverview: {
    fontSize: 17,
    fontWeight: "400",
  },
  lastSummaryBottom: {
    maxHeight: list_max_timestampHeights,
  },
  timestampList: {
    gap: timestamp_gap,
    backgroundColor: "transparent",
  },
  timestamp: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    minWidth: TS_WIDTH,
    borderRadius: 10,
    backgroundColor: "#6162634a",
    borderColor: "#0303039b",
    justifyContent: "center",
    alignItems: "center",
  },
  summaryBottomItems: {
    flexDirection: "row",
    backgroundColor: "transparent",
    justifyContent: "flex-start",
    alignItems: "center",
    height: timestamp_height,
    gap: 20,
    width: "80%",
  },
  moreChapters: {
    fontSize: 13,
    fontWeight: "500",
    opacity: 0.7,
    paddingLeft: TS_WIDTH + 20,
  },

  progressRow: { gap: CARD_GAP },
  progressContainer: {
    backgroundColor: "#6968686b",
    borderColor: "#5454549b",
    borderWidth: 1,
    shadowRadius: 2,
    borderRadius: 15,
    padding: 16,
    flexDirection: "column",
    justifyContent: "flex-start",
    gap: 12,
  },
  progressContainerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "transparent",
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  fill: {
    height: 6,
    backgroundColor: "#009ee8",
  },
  percent: { fontSize: 13, fontWeight: "600", color: "#ffffff" },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "transparent",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#009ee8",
    opacity: 0.3,
  },
  dotActive: { width: 16, opacity: 1 },

  recentScroll: { maxHeight: LIST_MAX_HEIGHT },
  recentContainer: { gap: ITEM_GAP },
  recentItems: {
    backgroundColor: "#6968686b",
    borderColor: "#5454549b",
    borderWidth: 1,
    shadowRadius: 2,
    borderRadius: 15,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    height: ITEM_HEIGHT,
  },
  recentStart: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "transparent",
    gap: 10,
    flex: 1,
  },
  recentItemIcons: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: "#009ee8",
    alignItems: "center",
    paddingLeft: 4,
    paddingTop: 2,
    justifyContent: "center",
  },
  recentMid: {
    flexDirection: "column",
    backgroundColor: "transparent",
    flex: 1,
  },
  recentTitle: { fontSize: 16, fontWeight: "bold" },
  recentMidLow: {
    flexDirection: "row",
    backgroundColor: "transparent",
    gap: 2,
  },
  recentEnd: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#009ee8",
    alignItems: "center",
    paddingLeft: 6,
    paddingTop: 2,
    justifyContent: "center",
  },
});
