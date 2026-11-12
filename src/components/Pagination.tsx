import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onPageChange,
}) => {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  if (totalPages <= 1) {
    return null;
  }

  return (
    <View style={[styles.paginationRow, { borderTopColor: colors.border }]}>
      <Pressable
        style={[
          styles.pageButton,
          { backgroundColor: colors.card, borderColor: colors.border },
          page <= 1 && styles.pageButtonDisabled,
        ]}
        disabled={page <= 1}
        onPress={() => onPageChange(Math.max(1, page - 1))}
      >
        <Ionicons
          name="chevron-back"
          size={16}
          color={page <= 1 ? colors.textMuted : colors.text}
        />
        <Text
          style={[
            styles.pageButtonText,
            { color: page <= 1 ? colors.textMuted : colors.text },
          ]}
        >
          Anterior
        </Text>
      </Pressable>

      <Text style={[styles.pageIndicator, { color: colors.text }]}>
        Pág. <Text style={{ fontWeight: '800' }}>{page}</Text> de {totalPages}
      </Text>

      <Pressable
        style={[
          styles.pageButton,
          { backgroundColor: colors.card, borderColor: colors.border },
          page >= totalPages && styles.pageButtonDisabled,
        ]}
        disabled={page >= totalPages}
        onPress={() => onPageChange(Math.min(totalPages, page + 1))}
      >
        <Text
          style={[
            styles.pageButtonText,
            { color: page >= totalPages ? colors.textMuted : colors.text },
          ]}
        >
          Siguiente
        </Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={page >= totalPages ? colors.textMuted : colors.text}
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pageIndicator: {
    fontSize: 13,
  },
});
