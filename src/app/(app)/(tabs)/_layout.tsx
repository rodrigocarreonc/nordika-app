// Barra de pestañas inferiores; oculta la pestaña Administración (`href: null`) a usuarios no staff.

import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../../constants/theme";
import { getUser } from "../../../utils/tokenStorage";

export default function TabsLayout() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getUser().then((u) => {
      if (isMounted) {
        setIsStaff(!!u?.is_staff);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          // La altura fija anula el margen inferior automático; se suma el de la barra del sistema.
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Catálogo",
          tabBarAccessibilityLabel: "Catálogo de muebles",
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "grid" : "grid-outline"}
              size={22}
              color={focused ? colors.accent : colors.tabIconDefault}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="favoritos"
        options={{
          title: "Favoritos",
          tabBarAccessibilityLabel: "Muebles favoritos",
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "heart" : "heart-outline"}
              size={22}
              color={focused ? colors.accent : colors.tabIconDefault}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="apartados"
        options={{
          title: "Apartados",
          tabBarAccessibilityLabel: "Apartados de muebles",
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "bookmark" : "bookmark-outline"}
              size={22}
              color={focused ? colors.accent : colors.tabIconDefault}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Administración",
          tabBarAccessibilityLabel: "Panel de administración",
          href: isStaff ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "shield" : "shield-outline"}
              size={22}
              color={focused ? colors.accent : colors.tabIconDefault}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarAccessibilityLabel: "Ajustes y perfil",
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "settings" : "settings-outline"}
              size={22}
              color={focused ? colors.accent : colors.tabIconDefault}
            />
          ),
        }}
      />
    </Tabs>
  );
}
