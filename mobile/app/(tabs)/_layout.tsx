import { SymbolView } from "expo-symbols";
import { Link, Tabs, usePathname } from "expo-router";
import { View, Pressable, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

type IconName = React.ComponentProps<typeof SymbolView>["name"];
type TabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0];

const styles = StyleSheet.create({
  barWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: 14, 
    gap: 4,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "#4b4b4b",
  },
  navItem: {
    height: 56,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  importWrap: {
    marginHorizontal: 6,
    width: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  importCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#02a2e7",
    borderWidth: 3,
    borderColor: "#4b4b4b",
    justifyContent: "center",
    alignItems: "center",
  },
  importCircleActive: { backgroundColor: "#0078ac" },
  navRow: { flexDirection: "row", alignItems: "center", gap: 6 },
});

const iconImport = StyleSheet.create({
  iconMargin: {
    marginTop: 4,
    marginLeft: 6,
  },
});

function NavItem({
  selected,
  onPress,
  icon,
  label,
  activeColor,
  iconStyle,
}: {
  selected: boolean;
  onPress?: (e: any) => void;
  icon: IconName;
  label: string;
  activeColor: string;
  iconStyle?: object;
}) {
  const [showLabel, setShowLabel] = useState(false);
  const color = selected ? activeColor : "#8c9092";

  useEffect(() => {
    if (!selected) {
      setShowLabel(false);
      return;
    }
    setShowLabel(true);
    const timer = setTimeout(() => setShowLabel(false), 3000);
    return () => clearTimeout(timer); 
  }, [selected]);

  return (
    <Pressable onPress={onPress} style={styles.navItem}>
      <Animated.View
        layout={LinearTransition.duration(200)}
        style={styles.navRow}
      >
        <SymbolView name={icon} tintColor={color} size={30} style={iconStyle} />
        {showLabel && (
          <Animated.Text
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={{ color }}
          >
            {label}
          </Animated.Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const TABS: Record<
  string,
  { label: string; icon: IconName; iconStyle?: object }
> = {
  index: {
    label: "Home",
    icon: { ios: "house", android: "home", web: "home" },
  },
  two: {
    label: "Settings",
    icon: { ios: "gearshape", android: "settings", web: "settings" },
    iconStyle: { marginTop: 2 },
  },
};

function FloatingTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.barWrap, { bottom: insets.bottom + 10 }]}
    >
      <Animated.View
        layout={LinearTransition.duration(200)}
        style={[
          styles.bar,
          { backgroundColor: Colors[colorScheme].background },
        ]}
      >
        {state.routes.map((route, index) => {
          const selected = state.index === index;
          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!selected && !event.defaultPrevented)
              navigation.navigate(route.name, route.params);
          };

          if (route.name === "import") {
            return (
              <Pressable
                key={route.key}
                style={styles.importWrap}
                onPress={onPress}
              >
                <View
                  style={[
                    styles.importCircle,
                    selected && styles.importCircleActive,
                  ]}
                >
                  <SymbolView
                    name={{
                      ios: "square.and.arrow.up",
                      android: "audio_file",
                      web: "audio_file",
                    }}
                    style={iconImport.iconMargin}
                    tintColor="#ffffff"
                    size={28}
                  />
                </View>
              </Pressable>
            );
          }

          const cfg = TABS[route.name];
          if (!cfg) return null;
          return (
            <NavItem
              key={route.key}
              selected={selected}
              onPress={onPress}
              icon={cfg.icon}
              iconStyle={cfg.iconStyle}
              label={cfg.label}
              activeColor={Colors[colorScheme].tint}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: useClientOnlyValue(false, true) }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable style={{ marginRight: 15 }}>
                {({ pressed }) => (
                  <SymbolView
                    name={{ ios: "info.circle", android: "info", web: "info" }}
                    size={25}
                    tintColor={Colors[colorScheme].text}
                    style={{ opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />

      <Tabs.Screen name="import" options={{ title: "Import" }} />
      <Tabs.Screen name="two" options={{ title: "Settings" }} />
    </Tabs>
  );
}
