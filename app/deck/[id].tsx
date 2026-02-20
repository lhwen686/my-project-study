import { Link, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type TextInputSubmitEditingEventData,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';

import { createOcclusionAtPoint, parseOcclusions, type OcclusionRect, toAbsoluteRect } from '@/data/occlusion';
import { CardShadow, CardShadowHeavy, Palette, Radius, Spacing } from '@/constants/design-tokens';
import { buildTemplatePreview, getTemplateFields, type TemplateKind } from '@/data/templates';
import {
  Card,
  Deck,
  bulkAddTag,
  bulkDeleteCards,
  bulkMoveCards,
  createCard,
  deleteCard,
  getCardsByDeckId,
  getDeckById,
  getDecks,
  importCardsFromCsv,
  updateCard,
} from '@/data/sqlite';

const DEFAULT_CSV = '';

const IMAGE_BOX_HEIGHT = 220;

const TEMPLATE_OPTIONS: { key: TemplateKind; label: string }[] = [
  { key: 'none', label: '手动' },
  { key: 'anatomy', label: '解剖' },
  { key: 'biochem', label: '生化' },
  { key: 'custom', label: '自定义' },
];

// ─── Card List Item ───────────────────────────────────────────────────────────

type CardItemProps = {
  card: Card;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onEdit: (card: Card) => void;
  onDelete: (id: number) => void;
};

const CardItem = memo(function CardItem({ card, isSelected, onToggleSelect, onEdit, onDelete }: CardItemProps) {
  const marks = parseOcclusions(card.occlusions);
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.front} numberOfLines={2}>{card.front}</Text>
        <Pressable style={isSelected ? styles.selectedBadge : styles.unselectedBadge} onPress={() => onToggleSelect(card.id)}>
          <Text style={styles.badgeText}>{isSelected ? '已选' : '选择'}</Text>
        </Pressable>
      </View>
      {!!card.image_uri && <Image source={{ uri: card.image_uri }} style={styles.listThumb} resizeMode="cover" />}
      <Text style={styles.back} numberOfLines={3}>{card.back}</Text>
      <Text style={styles.meta}>标签: {card.tags || '无'} | 遗忘次数: {card.lapse_count ?? 0} | 遮挡题: {marks.length > 0 ? marks.length : '无'}</Text>
      <View style={styles.row}>
        <Pressable style={styles.editBtn} onPress={() => onEdit(card)}>
          <Text style={styles.btnTextWhite}>编辑</Text>
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={() => onDelete(card.id)}>
          <Text style={styles.btnTextWhite}>删除</Text>
        </Pressable>
      </View>
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deckId = Number(id);

  // ── Core data ──────────────────────────────────────────────────────────────
  const [deck, setDeck] = useState<Deck | null>(null);
  const [allDecks, setAllDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [message, setMessage] = useState('');

  // ── Add / Edit form ────────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [occlusions, setOcclusions] = useState<OcclusionRect[]>([]);
  const [occlusionLabel, setOcclusionLabel] = useState('');
  const [imageBoxSize, setImageBoxSize] = useState({ width: 1, height: IMAGE_BOX_HEIGHT });
  const [editingId, setEditingId] = useState<number | null>(null);

  // ── Templates ──────────────────────────────────────────────────────────────
  const [templateKind, setTemplateKind] = useState<TemplateKind>('none');
  const [customTemplateFieldsInput, setCustomTemplateFieldsInput] = useState('问题,答案');
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});

  // ── Search / Filter ────────────────────────────────────────────────────────
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [onlyDue, setOnlyDue] = useState(false);
  const [onlyLapse, setOnlyLapse] = useState(false);
  const [tagFilter, setTagFilter] = useState('');

  // ── Batch operations ───────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetDeckId, setTargetDeckId] = useState('');
  const [batchTag, setBatchTag] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);

  // ── CSV Import ─────────────────────────────────────────────────────────────
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState(DEFAULT_CSV);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadDeckDetail = useCallback(async () => {
    if (!Number.isFinite(deckId)) return;
    try {
      const [deckData, cardRows, decks] = await Promise.all([getDeckById(deckId), getCardsByDeckId(deckId), getDecks()]);
      setDeck(deckData ?? null);
      setCards(cardRows);
      setAllDecks(decks);
    } catch (error) {
      console.error('Failed to load deck detail:', error);
      setMessage('加载失败');
    }
  }, [deckId]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [queryInput]);

  useEffect(() => {
    loadDeckDetail();
  }, [loadDeckDetail]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(t);
  }, [message]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const templateFields = useMemo(
    () => getTemplateFields(templateKind, customTemplateFieldsInput),
    [templateKind, customTemplateFieldsInput],
  );

  const templatePreview = useMemo(
    () => buildTemplatePreview(templateKind, templateFields, templateValues),
    [templateFields, templateKind, templateValues],
  );

  const filteredCards = useMemo(() => {
    const nowIso = new Date().toISOString();
    const tagNeedle = tagFilter.trim().toLowerCase();
    return cards.filter((c) => {
      if (onlyDue && c.due_date > nowIso) return false;
      if (onlyLapse && (c.lapse_count ?? 0) <= 0) return false;
      if (tagNeedle && !(c.tags ?? '').toLowerCase().split(';').map((x) => x.trim()).includes(tagNeedle)) return false;
      if (!query) return true;
      const hay = `${c.front}\n${c.back}\n${c.tags ?? ''}`.toLowerCase();
      return hay.includes(query);
    });
  }, [cards, onlyDue, onlyLapse, query, tagFilter]);

  const selectedIds = useMemo(() => [...selected], [selected]);

  // ── Form helpers ───────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setFront('');
    setBack('');
    setTags('');
    setImageUri('');
    setOcclusions([]);
    setOcclusionLabel('');
    setTemplateKind('none');
    setTemplateValues({});
    setEditingId(null);
  }, []);

  const openAddModal = useCallback(() => {
    resetForm();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAddModal(true);
  }, [resetForm]);

  const closeAddModal = useCallback(() => {
    setShowAddModal(false);
    resetForm();
  }, [resetForm]);

  const switchTemplate = useCallback((kind: TemplateKind) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTemplateKind(kind);
    setTemplateValues({});
  }, []);

  const applyTemplateToCard = () => {
    if (templateKind === 'none') return;
    setFront(templatePreview.front);
    setBack(templatePreview.back);
  };

  const onSubmit = async () => {
    if (!front.trim() || !back.trim() || !Number.isFinite(deckId)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const occlusionPayload = occlusions.length > 0 ? JSON.stringify(occlusions) : undefined;
    if (editingId) {
      await updateCard(editingId, front.trim(), back.trim(), tags.trim() || undefined, imageUri.trim() || undefined, occlusionPayload);
      setMessage('已更新卡片');
    } else {
      await createCard(deckId, front.trim(), back.trim(), tags.trim() || undefined, imageUri.trim() || undefined, occlusionPayload);
      setMessage('已新增卡片');
    }
    resetForm();
    setShowAddModal(false);
    await loadDeckDetail();
  };

  const onEdit = useCallback((card: Card) => {
    setEditingId(card.id);
    setFront(card.front);
    setBack(card.back);
    setTags(card.tags ?? '');
    setImageUri(card.image_uri ?? '');
    setOcclusions(parseOcclusions(card.occlusions));
    setTemplateKind('none');
    setTemplateValues({});
    setShowAddModal(true);
  }, []);

  const onDelete = useCallback(async (cardId: number) => {
    await deleteCard(cardId);
    setMessage('已删除卡片');
    await loadDeckDetail();
  }, [loadDeckDetail]);

  // ── CSV Import ─────────────────────────────────────────────────────────────
  const onImport = async () => {
    try {
      const count = await importCardsFromCsv(csvText);
      setMessage(`CSV 导入成功：${count} 张`);
      setShowCsvModal(false);
      await loadDeckDetail();
    } catch (error) {
      console.error(error);
      setMessage('CSV 导入失败，请检查表头和字段。');
    }
  };

  // ── Occlusion handlers ─────────────────────────────────────────────────────
  const onImageBoxLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setImageBoxSize({ width, height });
  };

  const onPressImage = (e: any) => {
    const pt = e.nativeEvent;
    const next = createOcclusionAtPoint(pt.locationX, pt.locationY, imageBoxSize.width, imageBoxSize.height);
    next.label = occlusionLabel.trim() || undefined;
    setOcclusions((prev) => [...prev, next]);
  };

  const applyLabelToLatest = (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    const label = e.nativeEvent.text.trim();
    if (!label || occlusions.length === 0) return;
    setOcclusions((prev) => prev.map((o, idx) => (idx === prev.length - 1 ? { ...o, label } : o)));
  };

  // ── Batch operations ───────────────────────────────────────────────────────
  const toggleSelect = useCallback((cardId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }, []);

  const runBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    Alert.alert('二次确认', `确认批量删除 ${selectedIds.length} 张卡片？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认删除',
        style: 'destructive',
        onPress: async () => {
          await bulkDeleteCards(selectedIds);
          setSelected(new Set());
          setMessage(`已批量删除 ${selectedIds.length} 张`);
          await loadDeckDetail();
        },
      },
    ]);
  };

  const runBulkMove = async () => {
    const target = Number(targetDeckId);
    if (!Number.isFinite(target) || selectedIds.length === 0) return;
    await bulkMoveCards(selectedIds, target);
    setSelected(new Set());
    setShowBatchModal(false);
    setTargetDeckId('');
    setMessage(`已移动 ${selectedIds.length} 张卡片到 deck ${target}`);
    await loadDeckDetail();
  };

  const runBulkTag = async () => {
    if (!batchTag.trim() || selectedIds.length === 0) return;
    await bulkAddTag(selectedIds, batchTag.trim());
    setSelected(new Set());
    setShowBatchModal(false);
    setBatchTag('');
    setMessage(`已给 ${selectedIds.length} 张卡片添加标签 ${batchTag.trim()}`);
    await loadDeckDetail();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <View style={styles.screen}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>{deck?.name ?? `Deck ${id}`}</Text>
        <Text style={styles.subtitle}>{filteredCards.length} 张卡片</Text>
      </View>

      {/* ─── Message Toast ───────────────────────────────────────────────── */}
      {!!message && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{message}</Text>
        </View>
      )}

      {/* ─── Search / Filter Toolbar ─────────────────────────────────────── */}
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color={Palette.textTertiary} style={styles.searchIcon} />
            <TextInput
              placeholder="搜索 front/back/tags..."
              placeholderTextColor={Palette.textTertiary}
              value={queryInput}
              onChangeText={setQueryInput}
              style={styles.searchInput}
            />
          </View>
          <Pressable style={styles.toolbarIconBtn} onPress={() => setShowCsvModal(true)} hitSlop={8}>
            <Ionicons name="document-text-outline" size={20} color={Palette.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.filterRow}>
          <Pressable style={[styles.filterChip, onlyDue && styles.filterChipActive]} onPress={() => setOnlyDue((v) => !v)}>
            <Text style={[styles.filterChipText, onlyDue && styles.filterChipTextActive]}>今日待复习</Text>
          </Pressable>
          <Pressable style={[styles.filterChip, onlyLapse && styles.filterChipActive]} onPress={() => setOnlyLapse((v) => !v)}>
            <Text style={[styles.filterChipText, onlyLapse && styles.filterChipTextActive]}>曾遗忘/易错</Text>
          </Pressable>
          <TextInput
            placeholder="标签筛选"
            placeholderTextColor={Palette.textTertiary}
            value={tagFilter}
            onChangeText={setTagFilter}
            style={styles.tagFilterInput}
          />
        </View>
      </View>

      {/* ─── Card List ───────────────────────────────────────────────────── */}
      <FlatList
        data={filteredCards}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        initialNumToRender={20}
        windowSize={11}
        removeClippedSubviews
        renderItem={({ item: card }) => (
          <CardItem
            card={card}
            isSelected={selected.has(card.id)}
            onToggleSelect={toggleSelect}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="albums-outline" size={48} color={Palette.textTertiary} />
            <Text style={styles.emptyText}>暂无卡片</Text>
            <Text style={styles.emptyHint}>点击右下角 + 按钮添加</Text>
          </View>
        }
      />

      {/* ─── Batch Action Bar (visible when cards selected) ──────────────── */}
      {selected.size > 0 && (
        <View style={styles.batchBar}>
          <Text style={styles.batchBarText}>已选 {selected.size} 张</Text>
          <View style={styles.batchActions}>
            <Pressable style={styles.batchActionBtn} onPress={() => setShowBatchModal(true)}>
              <Ionicons name="settings-outline" size={18} color={Palette.primary} />
              <Text style={styles.batchActionLabel}>更多</Text>
            </Pressable>
            <Pressable style={styles.batchActionBtn} onPress={runBulkDelete}>
              <Ionicons name="trash-outline" size={18} color={Palette.danger} />
              <Text style={[styles.batchActionLabel, { color: Palette.danger }]}>删除</Text>
            </Pressable>
            <Pressable style={styles.batchActionBtn} onPress={() => setSelected(new Set())}>
              <Ionicons name="close-circle-outline" size={18} color={Palette.textSecondary} />
              <Text style={styles.batchActionLabel}>取消</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ─── Bottom: Review Button ───────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <Link href={`/review/${id}`} style={styles.reviewButton}>
          开始复习
        </Link>
      </View>

      {/* ─── FAB (Floating Action Button) ────────────────────────────────── */}
      <Pressable style={styles.fab} onPress={openAddModal}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      {/* ═════════════════════════════════════════════════════════════════════
          Add / Edit Card Modal
          ═════════════════════════════════════════════════════════════════════ */}
      <Modal visible={showAddModal} animationType="slide" transparent={true} onRequestClose={closeAddModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeAddModal} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalSheet}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <View style={styles.modalTitleRow}>
                <Text style={styles.modalTitle}>{editingId ? '编辑卡片' : '新增卡片'}</Text>
                <Pressable onPress={closeAddModal} hitSlop={12}>
                  <Ionicons name="close" size={24} color={Palette.textSecondary} />
                </Pressable>
              </View>
            </View>

            {/* Modal Body */}
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ── Template Segmented Control ─────────────────────────────── */}
              <Text style={styles.modalLabel}>模板</Text>
              <View style={styles.segmentedControl}>
                {TEMPLATE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.key}
                    style={[styles.segment, templateKind === opt.key && styles.segmentActive]}
                    onPress={() => switchTemplate(opt.key)}
                  >
                    <Text style={[styles.segmentText, templateKind === opt.key && styles.segmentTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Custom template fields definition */}
              {templateKind === 'custom' && (
                <TextInput
                  placeholder="自定义字段（逗号分隔）：如 主题,考点,易错点"
                  placeholderTextColor={Palette.textTertiary}
                  value={customTemplateFieldsInput}
                  onChangeText={setCustomTemplateFieldsInput}
                  style={styles.modalInput}
                />
              )}

              {/* Template field inputs */}
              {templateKind !== 'none' && templateFields.map((field) => (
                <TextInput
                  key={field}
                  placeholder={field}
                  placeholderTextColor={Palette.textTertiary}
                  value={templateValues[field] ?? ''}
                  onChangeText={(text) => setTemplateValues((prev) => ({ ...prev, [field]: text }))}
                  style={styles.modalInput}
                />
              ))}

              {/* Template preview & apply */}
              {templateKind !== 'none' && (
                <>
                  <View style={styles.previewBox}>
                    <Text style={styles.previewLabel}>front 预览</Text>
                    <Text style={styles.previewText}>{templatePreview.front || '-'}</Text>
                    <Text style={styles.previewLabel}>back 预览</Text>
                    <Text style={styles.previewText}>{templatePreview.back || '-'}</Text>
                  </View>
                  <Pressable style={styles.applyTemplateBtn} onPress={applyTemplateToCard}>
                    <Text style={styles.applyTemplateBtnText}>一键生成 front/back</Text>
                  </Pressable>
                </>
              )}

              {/* ── Front ─────────────────────────────────────────────────── */}
              <Text style={styles.modalLabel}>正面 (Front)</Text>
              <TextInput
                placeholder="输入卡片正面内容..."
                placeholderTextColor={Palette.textTertiary}
                value={front}
                onChangeText={setFront}
                multiline
                style={[styles.modalInput, styles.modalInputMultiline]}
                textAlignVertical="top"
              />

              {/* ── Back ──────────────────────────────────────────────────── */}
              <Text style={styles.modalLabel}>背面 (Back)</Text>
              <TextInput
                placeholder="输入卡片背面内容..."
                placeholderTextColor={Palette.textTertiary}
                value={back}
                onChangeText={setBack}
                multiline
                style={[styles.modalInput, styles.modalInputMultiline]}
                textAlignVertical="top"
              />

              {/* ── Tags ──────────────────────────────────────────────────── */}
              <Text style={styles.modalLabel}>标签</Text>
              <TextInput
                placeholder="标签（可选，; 分隔）"
                placeholderTextColor={Palette.textTertiary}
                value={tags}
                onChangeText={setTags}
                style={styles.modalInput}
              />

              {/* ── Image URI ─────────────────────────────────────────────── */}
              <TextInput
                placeholder="图片 URI（可选）"
                placeholderTextColor={Palette.textTertiary}
                value={imageUri}
                onChangeText={setImageUri}
                style={styles.modalInput}
              />

              {/* ── Occlusion Editor ──────────────────────────────────────── */}
              {!!imageUri && (
                <View style={styles.editorWrap}>
                  <Text style={styles.editorHint}>点击图片添加遮挡标注</Text>
                  <TextInput
                    placeholder="遮挡块名称（可选）"
                    placeholderTextColor={Palette.textTertiary}
                    value={occlusionLabel}
                    onChangeText={setOcclusionLabel}
                    onSubmitEditing={applyLabelToLatest}
                    style={styles.modalInput}
                  />
                  <Pressable onPress={onPressImage} onLayout={onImageBoxLayout} style={styles.imagePressArea}>
                    <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
                    {occlusions.map((rect, idx) => {
                      const abs = toAbsoluteRect(rect, imageBoxSize.width, imageBoxSize.height);
                      return (
                        <View key={`${idx}-${rect.x}`} style={[styles.occlusionRect, { left: abs.left, top: abs.top, width: abs.width, height: abs.height }]}>
                          <Text style={styles.occlusionText}>{rect.label || `#${idx + 1}`}</Text>
                        </View>
                      );
                    })}
                  </Pressable>
                  <View style={styles.row}>
                    <Pressable style={styles.secondaryBtnSmall} onPress={() => setOcclusions((prev) => prev.slice(0, -1))}>
                      <Text style={styles.btnTextWhite}>撤销</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryBtnSmall} onPress={() => setOcclusions([])}>
                      <Text style={styles.btnTextWhite}>清空</Text>
                    </Pressable>
                    <Text style={styles.metaText}>已标注：{occlusions.length}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal Footer: Save */}
            <View style={styles.modalFooter}>
              <Pressable style={styles.saveButton} onPress={onSubmit}>
                <Text style={styles.saveButtonText}>{editingId ? '保存修改' : '保存卡片'}</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════
          CSV Import Modal
          ═════════════════════════════════════════════════════════════════════ */}
      <Modal visible={showCsvModal} animationType="slide" transparent={true} onRequestClose={() => setShowCsvModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowCsvModal(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.csvModalSheet}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <View style={styles.modalTitleRow}>
                <Text style={styles.modalTitle}>CSV 导入</Text>
                <Pressable onPress={() => setShowCsvModal(false)} hitSlop={12}>
                  <Ionicons name="close" size={24} color={Palette.textSecondary} />
                </Pressable>
              </View>
            </View>
            <ScrollView style={styles.csvModalBody} contentContainerStyle={styles.csvModalBodyContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.csvGuideTitle}>{'💡 批量导入指南'}</Text>
              <Text style={styles.csvGuideText}>
                {'1. 推荐使用 Excel 或 WPS 整理你的题目，然后另存为 .csv 格式。\n2. 数据必须包含 4 列，顺序依次为：卡包名, 正面(题目), 背面(答案), 标签(选填)。\n3. 你也可以直接在下方粘贴符合格式的文本。'}
              </Text>
              <TextInput
                multiline
                value={csvText}
                onChangeText={setCsvText}
                style={styles.csvInput}
                textAlignVertical="top"
                placeholderTextColor={Palette.textTertiary}
                placeholder={'解剖学,肱骨的解剖颈在哪里？,位于大结节和小结节下方,骨科;解剖\n生化,三羧酸循环的限速酶是？,异柠檬酸脱氢酶,生化;代谢'}
              />
              <Pressable style={styles.saveButton} onPress={onImport}>
                <Text style={styles.saveButtonText}>开始批量导入</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════
          Batch Operations Modal
          ═════════════════════════════════════════════════════════════════════ */}
      <Modal visible={showBatchModal} animationType="slide" transparent={true} onRequestClose={() => setShowBatchModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowBatchModal(false)} />
          <View style={styles.batchModalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <View style={styles.modalTitleRow}>
                <Text style={styles.modalTitle}>批量操作（已选 {selectedIds.length} 张）</Text>
                <Pressable onPress={() => setShowBatchModal(false)} hitSlop={12}>
                  <Ionicons name="close" size={24} color={Palette.textSecondary} />
                </Pressable>
              </View>
            </View>
            <View style={styles.batchModalBody}>
              <Text style={styles.modalLabel}>移动到其他牌组</Text>
              <View style={styles.batchInputRow}>
                <TextInput
                  placeholder={`目标 deckId (${allDecks.map((d) => `${d.id}:${d.name}`).join(', ')})`}
                  placeholderTextColor={Palette.textTertiary}
                  value={targetDeckId}
                  onChangeText={setTargetDeckId}
                  style={[styles.modalInput, { flex: 1 }]}
                  keyboardType="number-pad"
                />
                <Pressable style={styles.batchConfirmBtn} onPress={runBulkMove}>
                  <Text style={styles.btnTextWhite}>移动</Text>
                </Pressable>
              </View>
              <Text style={styles.modalLabel}>批量加标签</Text>
              <View style={styles.batchInputRow}>
                <TextInput
                  placeholder="输入标签"
                  placeholderTextColor={Palette.textTertiary}
                  value={batchTag}
                  onChangeText={setBatchTag}
                  style={[styles.modalInput, { flex: 1 }]}
                />
                <Pressable style={styles.batchConfirmBtn} onPress={runBulkTag}>
                  <Text style={styles.btnTextWhite}>添加</Text>
                </Pressable>
              </View>
              <Pressable style={styles.batchDeleteBtn} onPress={runBulkDelete}>
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                <Text style={styles.batchDeleteBtnText}>批量删除</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // ── Screen layout ──────────────────────────────────────────────────────────
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    paddingHorizontal: Spacing.page,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Palette.textPrimary,
  },
  subtitle: {
    color: Palette.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },

  // ── Toast ──────────────────────────────────────────────────────────────────
  toast: {
    marginHorizontal: Spacing.page,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.button,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 4,
  },
  toastText: {
    color: Palette.primary,
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Toolbar / Filters ─────────────────────────────────────────────────────
  toolbar: {
    paddingHorizontal: Spacing.page,
    paddingVertical: 12,
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surface,
    borderRadius: Radius.input,
    paddingHorizontal: 12,
    ...CardShadow,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Palette.textPrimary,
  },
  toolbarIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...CardShadow,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.badge,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  filterChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Palette.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  tagFilterInput: {
    flex: 1,
    backgroundColor: Palette.surface,
    borderRadius: Radius.badge,
    paddingHorizontal: 14,
    paddingVertical: 7,
    fontSize: 13,
    color: Palette.textPrimary,
    borderWidth: 1,
    borderColor: Palette.border,
  },

  // ── Card List ──────────────────────────────────────────────────────────────
  list: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.page,
    paddingTop: 4,
    gap: 12,
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.textSecondary,
  },
  emptyHint: {
    fontSize: 13,
    color: Palette.textTertiary,
  },

  // ── CardItem ───────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.card,
    gap: 8,
    padding: Spacing.cardPad,
    ...CardShadow,
  },
  front: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.textPrimary,
    flex: 1,
  },
  back: {
    color: Palette.textSecondary,
    fontSize: 15,
  },
  meta: {
    color: Palette.primary,
    fontSize: 13,
  },
  metaText: {
    color: Palette.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  editBtn: {
    backgroundColor: Palette.success,
    borderRadius: Radius.button,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: Palette.danger,
    borderRadius: Radius.button,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  selectedBadge: {
    backgroundColor: Palette.success,
    borderRadius: Radius.badge,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unselectedBadge: {
    backgroundColor: Palette.textTertiary,
    borderRadius: Radius.badge,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  listThumb: {
    width: '100%',
    height: 150,
    borderRadius: Radius.input,
    marginVertical: 4,
  },

  // ── Batch Action Bar ───────────────────────────────────────────────────────
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.page,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  batchBarText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.textPrimary,
  },
  batchActions: {
    flexDirection: 'row',
    gap: 16,
  },
  batchActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batchActionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Palette.primary,
  },

  // ── Bottom Bar & Review ────────────────────────────────────────────────────
  bottomBar: {
    paddingHorizontal: Spacing.page,
    paddingVertical: 12,
    paddingBottom: 20,
    backgroundColor: Palette.background,
  },
  reviewButton: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.button,
    color: '#FFFFFF',
    overflow: 'hidden',
    padding: 16,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },

  // ── FAB ────────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: Spacing.page,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...CardShadowHeavy,
  },

  // ── Modal (shared) ─────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: Spacing.page,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.border,
    marginBottom: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Palette.textPrimary,
  },
  modalBody: {
    flexGrow: 1,
    flexShrink: 1,
  },
  modalBodyContent: {
    paddingHorizontal: Spacing.page,
    paddingBottom: 16,
    gap: 12,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.textSecondary,
    marginTop: 4,
  },
  modalInput: {
    backgroundColor: Palette.divider,
    borderRadius: Radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Palette.textPrimary,
  },
  modalInputMultiline: {
    minHeight: 100,
  },
  modalFooter: {
    paddingHorizontal: Spacing.page,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },

  // ── Segmented Control ──────────────────────────────────────────────────────
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Palette.divider,
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: Palette.surface,
    ...CardShadow,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: Palette.textSecondary,
  },
  segmentTextActive: {
    color: Palette.primary,
    fontWeight: '600',
  },

  // ── Template Preview ───────────────────────────────────────────────────────
  previewBox: {
    backgroundColor: Palette.divider,
    borderRadius: Radius.input,
    padding: 12,
    gap: 4,
  },
  previewLabel: {
    color: Palette.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  previewText: {
    color: Palette.textPrimary,
    fontSize: 13,
  },
  applyTemplateBtn: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.button,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyTemplateBtnText: {
    color: Palette.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Save Button ────────────────────────────────────────────────────────────
  saveButton: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.button,
    paddingVertical: 16,
    alignItems: 'center',
    ...CardShadow,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Small secondary buttons ────────────────────────────────────────────────
  secondaryBtnSmall: {
    backgroundColor: Palette.textTertiary,
    borderRadius: Radius.button,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },

  // ── Occlusion Editor ───────────────────────────────────────────────────────
  editorWrap: {
    gap: 8,
  },
  editorHint: {
    color: Palette.textSecondary,
    fontSize: 12,
  },
  imagePressArea: {
    borderRadius: Radius.input,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    height: IMAGE_BOX_HEIGHT,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  occlusionRect: {
    position: 'absolute',
    backgroundColor: 'rgba(37, 99, 235, 0.65)',
    borderWidth: 1,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  occlusionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── CSV Modal ──────────────────────────────────────────────────────────────
  csvModalSheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
  },
  csvModalBody: {
    flexGrow: 1,
    flexShrink: 1,
  },
  csvModalBodyContent: {
    paddingHorizontal: Spacing.page,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 12,
  },
  csvGuideTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.textPrimary,
  },
  csvGuideText: {
    fontSize: 13,
    lineHeight: 20,
    color: Palette.textSecondary,
  },
  csvInput: {
    backgroundColor: Palette.divider,
    borderRadius: Radius.input,
    padding: 14,
    fontSize: 14,
    color: Palette.textPrimary,
    minHeight: 120,
  },

  // ── Batch Modal ────────────────────────────────────────────────────────────
  batchModalSheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  batchModalBody: {
    paddingHorizontal: Spacing.page,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 12,
  },
  batchInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  batchConfirmBtn: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.button,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  batchDeleteBtn: {
    backgroundColor: Palette.danger,
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  batchDeleteBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
