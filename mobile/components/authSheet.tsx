import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const SPRING = { damping: 22, stiffness: 220 };

export default function AuthSheet() {
  const { session, loading } = useAuth();
  const { height } = useWindowDimensions();

  const FULL = height * 0.9;
  const REST = FULL - height * 0.55;

  const translateY = useSharedValue(FULL);
  const startY = useSharedValue(0);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const visible = !loading && !session;

  useEffect(() => {
    translateY.value = visible ? withSpring(REST, SPRING) : FULL;
  }, [visible, REST]);

  const pan = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      const next = startY.value + e.translationY;
      translateY.value = Math.min(Math.max(next, 0), REST);
    })
    .onEnd((e) => {
      const projected = translateY.value + e.velocityY * 0.2;
      const target = projected < REST / 2 ? 0 : REST;
      translateY.value = withSpring(target, SPRING);
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, REST], [0.75, 0.5]),
  }));

  async function submit() {
    setBusy(true);
    setError(null);
    setInfo(null);
    const creds = { email: email.trim(), password };
    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword(creds)
        : await supabase.auth.signUp(creds);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (mode === "signup" && !data.session) {
      setInfo("Check your email to confirm your account, then sign in.");
      setMode("signin");
    }
  }

  if (!visible) return null;

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !busy;

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, backdropStyle]} />
      <Animated.View style={[styles.sheet, { height: FULL }, sheetStyle]}>
        <GestureDetector gesture={pan}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
            <Text style={styles.title}>
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </Text>
            <Text style={styles.subtitle}>
              {mode === "signin"
                ? "Sign in to see your summaries."
                : "Your summaries stay private to your account."}
            </Text>
          </View>
        </GestureDetector>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#9a9a9a"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onFocus={() => {
              translateY.value = withSpring(0, SPRING);
            }}
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password (min. 6 characters)"
            placeholderTextColor="#9a9a9a"
            secureTextEntry
            autoCapitalize="none"
            onFocus={() => {
              translateY.value = withSpring(0, SPRING);
            }}
            onSubmitEditing={() => canSubmit && submit()}
          />

          {error && <Text style={styles.error}>{error}</Text>}
          {info && <Text style={styles.info}>{info}</Text>}

          <Pressable
            style={[styles.button, !canSubmit && { opacity: 0.4 }]}
            disabled={!canSubmit}
            onPress={submit}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === "signin" ? "Sign in" : "Sign up"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"));
              setError(null);
              setInfo(null);
            }}
          >
            <Text style={styles.switch}>
              {mode === "signin"
                ? "No account yet? Sign up"
                : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#2b2b2b",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
  },
  handleArea: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 16,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#6d6b6b",
    marginBottom: 18,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#bbb", fontSize: 13, marginTop: 4 },
  form: { gap: 12 },
  input: {
    backgroundColor: "#4a4a4a",
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    color: "#fff",
    fontSize: 15,
  },
  button: {
    backgroundColor: "#009ee8",
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  switch: { color: "#009ee8", textAlign: "center", marginTop: 6 },
  error: { color: "#ff6b6b", fontSize: 13 },
  info: { color: "#8fd694", fontSize: 13 },
});