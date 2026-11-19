import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/use-theme';

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export interface DialogButton {
  text: string;
  style?: DialogButtonStyle;
  onPress?: () => void | Promise<void>;
}

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: 'default' | 'destructive';
  buttons?: DialogButton[];
  loading?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  onClose?: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  confirmStyle = 'default',
  buttons,
  loading: externalLoading = false,
  onConfirm,
  onCancel,
  onClose,
}) => {
  const colors = useTheme();
  const [internalLoading, setInternalLoading] = useState(false);

  const isLoading = externalLoading || internalLoading;

  const handleBackdropPress = () => {
    if (isLoading) return;
    if (onClose) {
      onClose();
    } else if (onCancel) {
      onCancel();
    }
  };

  const handleAction = async (action?: () => void | Promise<void>) => {
    if (!action) {
      if (onClose) onClose();
      return;
    }
    try {
      setInternalLoading(true);
      await action();
    } finally {
      setInternalLoading(false);
    }
  };

  const isDestructive = confirmStyle === 'destructive';

  // Determine icon
  const getIcon = () => {
    if (isDestructive) {
      return (
        <View style={[styles.iconContainer, { backgroundColor: `${colors.danger}15` }]}>
          <Ionicons name="alert-circle-outline" size={26} color={colors.danger} />
        </View>
      );
    }
    return (
      <View style={[styles.iconContainer, { backgroundColor: `${colors.accent}15` }]}>
        <Ionicons name="help-circle-outline" size={26} color={colors.accent} />
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleBackdropPress}
    >
      <View style={styles.overlay}>
        {/* Backdrop pressable closes modal when clicking outside content */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
          accessible={false}
        />

        {/* Modal content box */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          // Prevent touches inside the dialog from bubbling to backdrop
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.headerRow}>
            {getIcon()}
            <View style={styles.titleWrapper}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            </View>
          </View>

          {Boolean(message) && (
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {message}
            </Text>
          )}

          {/* Button actions */}
          {buttons && buttons.length > 0 ? (
            <View style={[styles.buttonsContainer, buttons.length > 2 && styles.buttonsColumn]}>
              {buttons.map((btn, index) => {
                const isBtnDestructive = btn.style === 'destructive';
                const isBtnCancel = btn.style === 'cancel';

                let bg = colors.accent;
                let textCol = '#FFFFFF';

                if (isBtnDestructive) {
                  bg = colors.danger;
                  textCol = '#FFFFFF';
                } else if (isBtnCancel) {
                  bg = colors.backgroundElement;
                  textCol = colors.text;
                }

                return (
                  <Pressable
                    key={index}
                    style={[
                      styles.btn,
                      { backgroundColor: bg },
                      Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                    ]}
                    onPress={() => handleAction(btn.onPress)}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel={btn.text}
                  >
                    <Text style={[styles.btnText, { color: textCol }]}>{btn.text}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.buttonsContainer}>
              {Boolean(cancelText) && (
                <Pressable
                  style={[
                    styles.btn,
                    styles.btnCancel,
                    { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                    Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                  ]}
                  onPress={() => handleAction(onCancel || onClose)}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={cancelText}
                >
                  <Text style={[styles.btnText, { color: colors.text }]}>
                    {cancelText}
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={[
                  styles.btn,
                  {
                    backgroundColor: isDestructive ? colors.danger : colors.accent,
                    opacity: isLoading ? 0.7 : 1,
                  },
                  Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                ]}
                onPress={() => handleAction(onConfirm)}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel={confirmText}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
                    {confirmText}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)',
      } as any,
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  titleWrapper: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  buttonsColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    borderWidth: 1,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
