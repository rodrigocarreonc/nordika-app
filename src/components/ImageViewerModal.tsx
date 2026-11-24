// Full-screen modal viewer for uncropped furniture images, closable via button, backdrop, back or Escape.

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ImageViewerModalProps {
  visible: boolean;
  imageUri: string | null | undefined;
  title?: string;
  onClose: () => void;
}

/**
 * Shows a full image with `contentFit="contain"` on a dark background.
 * It closes with the button, by tapping outside the photo, with the back button or the Escape key on Web.
 */
export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  imageUri,
  title,
  onClose,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isOpen = visible && Boolean(imageUri);

  // On Web it listens for the Escape key to close the viewer naturally from the keyboard.
  useEffect(() => {
    if (Platform.OS !== "web" || !isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Explicit dimensions with an outer margin so expo-image doesn't collapse and a clickable area remains to close.
  const frameWidth = Math.max(Math.min(width * 0.92, 1200), 200);
  const frameHeight = Math.max(Math.min(height * 0.78, 840), 200);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        testID="fullscreen-image-modal"
        accessibilityViewIsModal
        style={styles.overlay}
      >
        {/* Clickable dark backdrop behind the image to close when tapping outside */}
        <Pressable
          testID="fullscreen-image-backdrop"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar imagen tocando el fondo"
        />

        {/* Top bar with an optional title and an always-visible close button */}
        <View
          style={[
            styles.topBar,
            {
              paddingTop: Math.max(insets.top + 8, 16),
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.titleContainer} pointerEvents="none">
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
          </View>

          <Pressable
            testID="fullscreen-image-close"
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cerrar imagen en pantalla completa"
            style={({ pressed }) => [
              styles.closeButton,
              { opacity: pressed ? 0.75 : 1 },
              Platform.OS === "web" && ({ cursor: "pointer" } as any),
            ]}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Centered image container; captures its own taps so tapping the photo doesn't close it */}
        <View
          style={[
            styles.imageFrame,
            {
              width: frameWidth,
              height: frameHeight,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              contentFit="contain"
              transition={150}
              accessibilityLabel={
                title
                  ? `Imagen de ${title} en pantalla completa`
                  : "Imagen en pantalla completa"
              }
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 2,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageFrame: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
