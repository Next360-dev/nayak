import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '../../src/api/dashboard';
import { fetchPosts } from '../../src/api/office';
import { Button, Card, TextField, ToolPage } from '../../src/ui';
import { highlight, radius, space, type, useTheme } from '../../src/theme';
import { useLang } from '../../src/i18n';

// Office assistant (same behaviour as the web popover): answers come ONLY from the numbers and stories already loaded
// for this office. There is no outside service and nothing is invented. Dictation: use the keyboard's microphone.
export default function VoiceScreen() {
  const { t } = useLang();
  const { c } = useTheme();
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard });
  const posts = useQuery({ queryKey: ['posts'], queryFn: fetchPosts });
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const d = dash.data;
  const urgent = d?.news?.urgent ?? 0;
  const negative = d?.news?.negative ?? 0;
  const newShares = d?.shares?.inbox?.new ?? 0;
  const draftPosts = (posts.data ?? []).filter((p) => p.status === 'draft').length;
  const open = (d?.board?.todo ?? 0) + (d?.board?.doing ?? 0);
  const stories = (d?.news?.attention ?? []).slice(0, 3).map((s) => s.headline);

  const ask = (text: string) => {
    const x = text.toLowerCase();
    let a: string;
    if (/urgent|అత్యవసర/.test(x)) a = t('voice.urgentAnswer', { count: urgent });
    else if (/negative|ప్రతికూల/.test(x)) a = t('voice.negativeAnswer', { count: negative });
    else if (/approv|post|ఆమోద/.test(x)) a = t('voice.approvalAnswer', { count: newShares, posts: draftPosts });
    else if (/work|task|team|పని|బృంద/.test(x)) a = t('voice.workAnswer', { count: open });
    else if (/news|stor|వార్త/.test(x)) a = stories.length ? t('voice.newsAnswer', { titles: stories.join('; ') }) : t('voice.noNewsAnswer');
    else a = t('voice.summaryAnswer', { urgent, approvals: newShares + draftPosts, work: open });
    setAnswer(a);
  };
  const prompts = [t('voice.prompt.urgent'), t('voice.prompt.approvals'), t('voice.prompt.work')];
  return (
    <ToolPage title={t('voice.title')} subtitle={t('voice.description')}>
      <Card style={{ padding: space.lg, gap: space.md }}>
        <TextField label={t('voice.inputLabel')} value={q} onChangeText={setQ} placeholder={t('voice.placeholder')} returnKeyType="send" onSubmitEditing={() => ask(q)} />
        <Button label={t('voice.ask')} onPress={() => ask(q)} disabled={dash.isLoading} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {prompts.map((p) => (
            <Pressable key={p} onPress={() => { setQ(p); ask(p); }} accessibilityRole="button" style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: highlight, justifyContent: 'center' }}>
              <Text style={[type.caption, { color: highlight, fontWeight: '700' }]}>{p}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      {answer ? (
        <Card style={{ padding: space.lg, gap: space.sm }}>
          <Text style={[type.caption, { color: c.muted }]}>{t('voice.answerLabel')}</Text>
          <Text selectable style={[type.reading, { color: c.text }]}>{answer}</Text>
          <Text style={[type.caption, { color: c.muted }]}>{t('voice.dataNote')}</Text>
        </Card>
      ) : null}
    </ToolPage>
  );
}
