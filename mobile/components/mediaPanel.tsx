import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";
import YoutubePlayer, { YoutubeIframeRef } from "react-native-youtube-iframe";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { audioUrl, Job } from "@/lib/api";

export type MediaControls = {
  play: () => void;
  pause: () => void;
  seekTo: (sec: number) => void;
};

type Props = {
  job: Job;
  onTime: (sec: number) => void;
  onPlaying: (playing: boolean) => void;
};

const BAR_COUNT = 24;

function Bar({ index, playing }: { index: number; playing: boolean }) {
  const level = useSharedValue(0.15);

  useEffect(() => {
    if (playing) {
      level.value = withDelay(
        index * 60,
        withRepeat(
          withTiming(1, {
            duration: 320 + (index % 5) * 90,
            easing: Easing.inOut(Easing.quad),
          }),
          -1,
          true,
        ),
      );
    } else {
      cancelAnimation(level);
      level.value = withTiming(0.15, { duration: 250 });
    }
  }, [playing]);

  const style = useAnimatedStyle(() => ({
    height: 8 + level.value * 72,
  }));

  return <Animated.View style={[styles.bar, style]} />;
}

function Spectrum({ playing }: { playing: boolean }) {
  return (
    <View style={styles.spectrum}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <Bar key={i} index={i} playing={playing} />
      ))}
    </View>
  );
}

const AudioPanel = forwardRef<MediaControls, Props>(
  ({ job, onTime, onPlaying }, ref) => {
    const player = useAudioPlayer(audioUrl(job.id), { updateInterval: 250 });
    const status = useAudioPlayerStatus(player);

    useEffect(() => {
      onTime(status.currentTime);
    }, [status.currentTime]);

    useEffect(() => {
      onPlaying(status.playing);
    }, [status.playing]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => player.play(),
        pause: () => player.pause(),
        seekTo: (s) => {
          player.seekTo(s);
        },
      }),
      [player],
    );

    return (
      <View style={styles.box}>
        <Spectrum playing={status.playing} />
      </View>
    );
  },
);

const VideoPanel = forwardRef<MediaControls, Props>(
  ({ job, onTime, onPlaying }, ref) => {
    const player = useVideoPlayer(audioUrl(job.id), (p: any) => {
      p.timeUpdateEventInterval = 0.25;
    });

    useEffect(() => {
      const timeSub = player.addListener("timeUpdate", ({ currentTime }) =>
        onTime(currentTime),
      );
      const playSub = player.addListener("playingChange", ({ isPlaying }) =>
        onPlaying(isPlaying),
      );
      return () => {
        timeSub.remove();
        playSub.remove();
      };
    }, [player]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => player.play(),
        pause: () => player.pause(),
        seekTo: (s) => {
          player.currentTime = s;
        },
      }),
      [player],
    );

    return (
      <VideoView
        player={player}
        style={styles.box}
        contentFit="contain"
        nativeControls
      />
    );
  },
);

const YouTubePanel = forwardRef<MediaControls, Props>(
  ({ job, onTime, onPlaying }, ref) => {
    const { width } = useWindowDimensions();
    const ytRef = useRef<YoutubeIframeRef>(null);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
      if (!playing) return;
      const timer = setInterval(async () => {
        const t = await ytRef.current?.getCurrentTime();
        if (t != null) onTime(t);
      }, 250);
      return () => clearInterval(timer);
    }, [playing]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => setPlaying(true),
        pause: () => setPlaying(false),
        seekTo: (s) => {
          ytRef.current?.seekTo(s, true);
        },
      }),
      [],
    );

    return (
      <View style={styles.youtube}>
        <YoutubePlayer
          ref={ytRef}
          height={((width - 32) * 9) / 16}
          videoId={job.youtube_id!}
          play={playing}
          onChangeState={(state: any) => {
            if (
              state === "playing" ||
              state === "paused" ||
              state === "ended"
            ) {
              const isPlaying = state === "playing";
              setPlaying(isPlaying);
              onPlaying(isPlaying);
            }
          }}
        />
      </View>
    );
  },
);

export const MediaPanel = forwardRef<MediaControls, Props>((props, ref) => {
  const { job } = props;
  if (job.youtube_id) return <YouTubePanel ref={ref} {...props} />;
  if (/\.(mp4|webm)$/i.test(job.filename ?? ""))
    return <VideoPanel ref={ref} {...props} />;
  return <AudioPanel ref={ref} {...props} />;
});

const styles = StyleSheet.create({
  box: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    backgroundColor: "#1c1c1e",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  youtube: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  spectrum: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: "#009ee8",
  },
});
