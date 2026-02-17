import { Link, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type TextInputSubmitEditingEventData,
} from 'react-native';

import { createOcclusionAtPoint, parseOcclusions, type OcclusionRect, toAbsoluteRect } from '@/data/occlusion';
import { CardShadow, Palette, Radius, Spacing } from '@/constants/design-tokens';
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

const DEFAULT_CSV = `deck,front,back,tags
数学,导数的定义,f'(x)=lim(h->0) (f(x+h)-f(x))/h,calculus;math
英语,ubiquitous,无处不在的,vocabulary;advanced`;

const IMAGE_BOX_HEIGHT = 220;

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
        <Text style={styles.front}>{card.front}</Text>
        <Pressable style={isSelected ? styles.selectedBadge : styles.unselectedBadge} onPress={() => onToggleSelect(card.id)}>
          <Text style={styles.badgeText}>{isSelected ? '已选' : '选择'}</Text>
        </Pressable>
      </View>
      {!!card.image_uri && <Image source={{ uri: card.image_uri }} style={styles.listThumb} resizeMode="cover" />}
      <Text style={styles.back}>{card.back}</Text>
      <Text style={styles.meta}>tags: {card.tags || '-'} | lapse: {card.lapse_count ?? 0} | 遮挡: {marks.length}</Text>
      <View style={styles.row}>
        <Pressable style={styles.editBtn} onPress={() => onEdit(card)}>
          <Text style={styles.buttonText}>编辑</Text>
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={() => onDelete(card.id)}>
          <Text style={styles.buttonText}>删除</Text>
        </Pressable>
      </View>
    </View>
  );
});

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deckId = Number(id);

  const [deck, setDeck] = useState<Deck | null>(null);
  const [allDecks, setAllDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [occlusions, setOcclusions] = useState<OcclusionRect[]>([]);
  const [occlusionLabel, setOcclusionLabel] = useState('');
  const [imageBoxSize, setImageBoxSize] = useState({ width: 1, height: IMAGE_BOX_HEIGHT });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [csvText, setCsvText] = useState(DEFAULT_CSV);
  const [message, setMessage] = useState('');

  const [templateKind, setTemplateKind] = useState<TemplateKind>('none');
  const [customTemplateFieldsInput, setCustomTemplateFieldsInput] = useState('问题,答案');
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});

  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [onlyDue, setOnlyDue] = useState(false);
  const [onlyLapse, setOnlyLapse] = useState(false);
  const [tagFilter, setTagFilter] = useState('');

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetDeckId, setTargetDeckId] = useState('');
  const [batchTag, setBatchTag] = useState('');

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

  const resetForm = () => {
    setFront('');
    setBack('');
    setTags('');
    setImageUri('');
    setOcclusions([]);
    setOcclusionLabel('');
    setTemplateKind('none');
    setTemplateValues({});
    setEditingId(null);
  };

  const applyTemplateToCard = () => {
    if (templateKind === 'none') return;
    setFront(templatePreview.front);
    setBack(templatePreview.back);
  };

  const onSubmit = async () => {
    if (!front.trim() || !back.trim() || !Number.isFinite(deckId)) return;
    const occlusionPayload = occlusions.length > 0 ? JSON.stringify(occlusions) : undefined;
    if (editingId) {
      await updateCard(editingId, front.trim(), back.trim(), tags.trim() || undefined, imageUri.trim() || undefined, occlusionPayload);
      setMessage('已更新卡片');
    } else {
      await createCard(deckId, front.trim(), back.trim(), tags.trim() || undefined, imageUri.trim() || undefined, occlusionPayload);
      setMessage('已新增卡片');
    }
    resetForm();
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
  }, []);

  const onDelete = useCallback(async (cardId: number) => {
    await deleteCard(cardId);
    setMessage('已删除卡片');
    await loadDeckDetail();
  }, [loadDeckDetail]);

  const onImport = async () => {
    try {
      const count = await importCardsFromCsv(csvText);
      setMessage(`CSV 导入成功：${count} 张`);
      await loadDeckDetail();
    } catch (error) {
      console.error(error);
      setMessage('CSV 导入失败，请检查表头和字段。');
    }
  };

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

  const toggleSelect = useCallback((cardId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }, []);

  const selectedIds = [...selected];

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
    setMessage(`已移动 ${selectedIds.length} 张卡片到 deck ${target}`);
    await loadDeckDetail();
  };

  const runBulkTag = async () => {
    if (!batchTag.trim() || selectedIds.length === 0) return;
    await bulkAddTag(selectedIds, batchTag.trim());
    setSelected(new Set());
    setMessage(`已给 ${selectedIds.length} 张卡片添加标签 ${batchTag.trim()}`);
    await loadDeckDetail();
  };

  return (
    <FlatList
      data={filteredCards}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.container}
      initialNumToRender={20}
      windowSize={11}
      removeClippedSubviews
      ListHeaderComponent={
        <>
          <Text style={styles.title}>DeckDetail · 卡片列表</Text>
          <Text style={styles.subtitle}>科目：{deck?.name ?? id}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.toolbar}>
            <TextInput placeholder="搜索 front/back/tags" value={queryInput} onChangeText={setQueryInput} style={styles.input} />
            <View style={styles.row}>
              <Pressable style={onlyDue ? styles.primaryButton : styles.secondaryButton} onPress={() => setOnlyDue((v) => !v)}>
                <Text style={styles.buttonText}>仅 due</Text>
              </Pressable>
              <Pressable style={onlyLapse ? styles.primaryButton : styles.secondaryButton} onPress={() => setOnlyLapse((v) => !v)}>
                <Text style={styles.buttonText}>仅 lapse≥1</Text>
              </Pressable>
            </View>
            <TextInput placeholder="按标签筛选(如 math)" value={tagFilter} onChangeText={setTagFilter} style={styles.input} />
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? '编辑卡片' : '新增卡片'}</Text>
            <Text style={styles.sectionTitle}>模板化建卡</Text>
            <View style={styles.row}>
              <Pressable style={templateKind === 'none' ? styles.primaryButton : styles.secondaryButton} onPress={() => setTemplateKind('none')}>
                <Text style={styles.buttonText}>手动</Text>
              </Pressable>
              <Pressable style={templateKind === 'anatomy' ? styles.primaryButton : styles.secondaryButton} onPress={() => setTemplateKind('anatomy')}>
                <Text style={styles.buttonText}>解剖模板</Text>
              </Pressable>
              <Pressable style={templateKind === 'biochem' ? styles.primaryButton : styles.secondaryButton} onPress={() => setTemplateKind('biochem')}>
                <Text style={styles.buttonText}>生化模板</Text>
              </Pressable>
              <Pressable style={templateKind === 'custom' ? styles.primaryButton : styles.secondaryButton} onPress={() => setTemplateKind('custom')}>
                <Text style={styles.buttonText}>自定义模板</Text>
              </Pressable>
            </View>

            {templateKind === 'custom' ? (
              <TextInput
                placeholder="自定义字段（逗号分隔）：如 主题,考点,易错点"
                value={customTemplateFieldsInput}
                onChangeText={setCustomTemplateFieldsInput}
                style={styles.input}
              />
            ) : null}

            {templateKind !== 'none'
              ? templateFields.map((field) => (
                  <TextInput
                    key={field}
                    placeholder={field}
                    value={templateValues[field] ?? ''}
                    onChangeText={(text) => setTemplateValues((prev) => ({ ...prev, [field]: text }))}
                    style={styles.input}
                  />
                ))
              : null}

            {templateKind !== 'none' ? (
              <>
                <View style={styles.formCardMuted}>
                  <Text style={styles.previewLabel}>front 预览</Text>
                  <Text style={styles.previewText}>{templatePreview.front || '-'}</Text>
                  <Text style={styles.previewLabel}>back 预览</Text>
                  <Text style={styles.previewText}>{templatePreview.back || '-'}</Text>
                </View>
                <Pressable style={styles.primaryButton} onPress={applyTemplateToCard}>
                  <Text style={styles.buttonText}>一键生成 front/back</Text>
                </Pressable>
              </>
            ) : null}

            <TextInput placeholder="front" value={front} onChangeText={setFront} style={styles.input} />
            <TextInput placeholder="back" value={back} onChangeText={setBack} style={styles.input} />
            <TextInput placeholder="tags (可选, ; 分隔)" value={tags} onChangeText={setTags} style={styles.input} />
            <TextInput placeholder="image uri (本地路径或 asset uri)" value={imageUri} onChangeText={setImageUri} style={styles.input} />

            {!!imageUri && (
              <View style={styles.editorWrap}>
                <Text style={styles.editorHint}>遮挡标注编辑器：点击图片添加矩形遮挡（支持≥5个）</Text>
                <TextInput
                  placeholder="给新遮挡块填写结构名（可选）"
                  value={occlusionLabel}
                  onChangeText={setOcclusionLabel}
                  onSubmitEditing={applyLabelToLatest}
                  style={styles.input}
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
                  <Pressable style={styles.secondaryButton} onPress={() => setOcclusions((prev) => prev.slice(0, -1))}>
                    <Text style={styles.buttonText}>撤销</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => setOcclusions([])}>
                    <Text style={styles.buttonText}>清空遮挡</Text>
                  </Pressable>
                  <Text style={styles.metaText}>已标注：{occlusions.length}</Text>
                </View>
              </View>
            )}
            <View style={styles.row}>
              <Pressable style={styles.primaryButton} onPress={onSubmit}>
                <Text style={styles.buttonText}>{editingId ? '保存修改' : '新增卡片'}</Text>
              </Pressable>
              {editingId ? (
                <Pressable style={styles.secondaryButton} onPress={resetForm}>
                  <Text style={styles.buttonText}>取消编辑</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>CSV 导入（deck,front,back,tags）</Text>
            <TextInput multiline value={csvText} onChangeText={setCsvText} style={[styles.input, styles.csvInput]} textAlignVertical="top" />
            <Pressable style={styles.primaryButton} onPress={onImport}>
              <Text style={styles.buttonText}>导入 CSV</Text>
            </Pressable>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>批量操作（已选 {selectedIds.length}）</Text>
            <View style={styles.row}>
              <TextInput
                placeholder={`移动到 deckId (可选: ${allDecks.map((d) => `${d.id}:${d.name}`).join(' ')})`}
                value={targetDeckId}
                onChangeText={setTargetDeckId}
                style={[styles.input, { flex: 1 }]}
              />
              <Pressable style={styles.primaryButton} onPress={runBulkMove}>
                <Text style={styles.buttonText}>批量移动</Text>
              </Pressable>
            </View>
            <View style={styles.row}>
              <TextInput placeholder="批量加标签" value={batchTag} onChangeText={setBatchTag} style={[styles.input, { flex: 1 }]} />
              <Pressable style={styles.primaryButton} onPress={runBulkTag}>
                <Text style={styles.buttonText}>批量加标签</Text>
              </Pressable>
            </View>
            <Pressable style={styles.deleteBtn} onPress={runBulkDelete}>
              <Text style={styles.buttonText}>批量删除（需确认）</Text>
            </Pressable>
          </View>
        </>
      }
      renderItem={({ item: card }) => (
        <CardItem
          card={card}
          isSelected={selected.has(card.id)}
          onToggleSelect={toggleSelect}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
      ListFooterComponent={
        <Link href={`/review/${id}`} style={styles.reviewButton}>
          开始复习
        </Link>
      }
    />
  );
}

const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────────────
  container: { backgroundColor: Palette.background, gap: 12, padding: Spacing.page },
  title: { fontSize: 24, fontWeight: '700', color: Palette.textPrimary },
  subtitle: { color: Palette.textSecondary, fontSize: 16, marginBottom: 8 },
  message: { color: Palette.primary, fontSize: 14, fontWeight: '500' },

  // ── Toolbar / Filters ───────────────────────────────────────────────────────
  toolbar: { backgroundColor: Palette.surface, borderRadius: Radius.card, gap: 10, padding: Spacing.cardPad, ...CardShadow },

  // ── Form cards ──────────────────────────────────────────────────────────────
  formCard: { backgroundColor: Palette.surface, borderRadius: Radius.card, gap: 10, padding: Spacing.cardPad, ...CardShadow },
  formCardMuted: { backgroundColor: Palette.divider, borderRadius: Radius.input, gap: 4, padding: 12 },
  formTitle: { fontSize: 16, fontWeight: '700', color: Palette.textPrimary },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Palette.textSecondary },
  previewLabel: { color: Palette.textSecondary, fontWeight: '700', fontSize: 12 },
  previewText: { color: Palette.textPrimary, fontSize: 13 },

  // ── Inputs ──────────────────────────────────────────────────────────────────
  input: { backgroundColor: Palette.surface, borderRadius: Radius.input, borderWidth: 1, borderColor: Palette.border, padding: 12, fontSize: 15, color: Palette.textPrimary },
  csvInput: { minHeight: 110 },

  // ── Row layouts ─────────────────────────────────────────────────────────────
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },

  // ── Buttons ─────────────────────────────────────────────────────────────────
  primaryButton: { backgroundColor: Palette.primary, borderRadius: Radius.button, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  secondaryButton: { backgroundColor: Palette.textTertiary, borderRadius: Radius.button, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },

  // ── CardItem styles ──────────────────────────────────────────────────────────
  card: { backgroundColor: Palette.surface, borderRadius: Radius.card, gap: 8, padding: Spacing.cardPad, ...CardShadow },
  front: { fontSize: 16, fontWeight: '600', color: Palette.textPrimary, flex: 1 },
  back: { color: Palette.textSecondary, fontSize: 15 },
  meta: { color: Palette.primary, fontSize: 13 },
  metaText: { color: Palette.primary, fontSize: 12, fontWeight: '600' },
  editBtn: { backgroundColor: Palette.success, borderRadius: Radius.button, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  deleteBtn: { backgroundColor: Palette.danger, borderRadius: Radius.button, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  selectedBadge: { backgroundColor: Palette.success, borderRadius: Radius.badge, paddingHorizontal: 10, paddingVertical: 4 },
  unselectedBadge: { backgroundColor: Palette.textTertiary, borderRadius: Radius.badge, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  reviewButton: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.button,
    color: '#FFFFFF',
    marginTop: 8,
    overflow: 'hidden',
    padding: 16,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Occlusion editor ────────────────────────────────────────────────────────
  editorWrap: { gap: 8 },
  editorHint: { color: Palette.textSecondary, fontSize: 12 },
  imagePressArea: {
    borderRadius: Radius.input,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    height: IMAGE_BOX_HEIGHT,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  previewImage: { width: '100%', height: '100%' },
  occlusionRect: {
    position: 'absolute',
    backgroundColor: 'rgba(37, 99, 235, 0.65)',
    borderWidth: 1,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  occlusionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  listThumb: { width: '100%', height: 150, borderRadius: Radius.input, marginVertical: 4 },
});
