import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";

export default function SettingsScreen() {
  const { session } = useAuth();
  const user = session?.user;

  const savedName: string = user?.user_metadata?.display_name ?? "";
  const shownName = savedName || user?.email?.split("@")[0] || "";

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(savedName);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const avatarUrl: string | undefined = user?.user_metadata?.avatar_url;
  const [uploading, setUploading] = useState(false);

  function startEdit() {
    setName(savedName);
    setPassword("");
    setError(null);
    setDone(false);
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    setError(null);

    const update: { data?: object; password?: string } = {};
    if (name.trim() !== savedName) update.data = { display_name: name.trim() };
    if (password) update.password = password;

    if (!update.data && !update.password) {
      setBusy(false);
      setEditing(false);
      return;
    }

    const { error } = await supabase.auth.updateUser(update);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(false);
    setDone(true);
  }

  const canSave = !busy && (password.length === 0 || password.length >= 6);

  async function pickAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (res.canceled || !user) return;

    const b64 = res.assets[0].base64;
    if (!b64) {
      setError("Could not read the image");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const path = `${user.id}/avatar.jpg`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, decode(b64), { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: uErr } = await supabase.auth.updateUser({
        data: { avatar_url: `${data.publicUrl}?v=${Date.now()}` },
      });
      if (uErr) throw uErr;
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Settings</Text>
      <View style={styles.card}>
        <Pressable
          style={styles.avatar}
          onPress={pickAvatar}
          disabled={uploading}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>
              {shownName.charAt(0).toUpperCase()}
            </Text>
          )}
          {uploading && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </Pressable>
        <Text style={styles.hint}>Tap to change photo</Text>
        {error && !editing && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.name}>{shownName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {done && <Text style={styles.ok}>Profile updated</Text>}
      </View>
      {editing ? (
        <View style={styles.card}>
          <Text style={styles.label}>Display name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#9a9a9a"
            autoCapitalize="words"
          />

          <Text style={styles.label}>New password (optional)</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Leave empty to keep current"
            placeholderTextColor="#9a9a9a"
            secureTextEntry
            autoCapitalize="none"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={() => setEditing(false)}
            >
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                styles.btnPrimary,
                !canSave && { opacity: 0.4 },
              ]}
              disabled={!canSave}
              onPress={save}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.action} onPress={startEdit}>
          <Text style={styles.actionText}>Edit profile</Text>
        </Pressable>
      )}

      <Pressable style={styles.action} onPress={() => supabase.auth.signOut()}>
        <Text style={[styles.actionText, { color: "#ff6b6b" }]}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 140,
    gap: 16,
  },
  title: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "bold",
    textAlign: "center",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  hint: { color: "#9a9a9a", fontSize: 12, textAlign: "center" },
  card: { backgroundColor: "#3a3a3a", borderRadius: 14, padding: 16, gap: 8 },
  avatar: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#009ee8",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarText: { color: "#fff", fontSize: 30, fontWeight: "700" },
  name: { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" },
  email: { color: "#bbb", fontSize: 13, textAlign: "center" },
  ok: { color: "#8fd694", fontSize: 13, textAlign: "center" },
  label: { color: "#bbb", fontSize: 12, marginTop: 4 },
  input: {
    backgroundColor: "#4a4a4a",
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 14,
    color: "#fff",
    fontSize: 15,
  },
  error: { color: "#ff6b6b", fontSize: 13 },
  row: { flexDirection: "row", gap: 10, marginTop: 8 },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnGhost: { backgroundColor: "#4a4a4a" },
  btnPrimary: { backgroundColor: "#009ee8" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  action: {
    backgroundColor: "#3a3a3a",
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
