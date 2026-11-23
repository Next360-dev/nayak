import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Mic, MicOff, Send, Sparkles, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLang } from '../../i18n/LangContext';

function makeAnswer(question, data, tr) {
  const q = question.toLocaleLowerCase();
  const { news, shares, board } = data;
  if (/urgent|priority|అత్యవసర/.test(q)) return tr('voice.urgentAnswer', { count: news.urgent ?? 0 });
  if (/negative|concern|issue|ప్రతికూల|సమస్య/.test(q)) return tr('voice.negativeAnswer', { count: news.negative ?? 0 });
  if (/approval|inbox|pending|share|ఆమోదం|ఇన్‌బాక్స్/.test(q)) return tr('voice.approvalAnswer', { count: shares.inbox.new ?? 0, posts: data.approvals?.pending ?? 0 });
  if (/project|task|పని|ప్రాజెక్ట్/.test(q)) return tr('voice.workAnswer', { count: (board?.todo || 0) + (board?.doing || 0) });
  if (/news|story|headline|వార్త/.test(q)) {
    const titles = (news.attention || []).slice(0, 2).map((item) => item.title).filter(Boolean);
    return titles.length ? tr('voice.newsAnswer', { titles: titles.join(' • ') }) : tr('voice.noNewsAnswer');
  }
  return tr('voice.summaryAnswer', {
    urgent: news.urgent ?? 0,
    approvals: (shares.inbox.new ?? 0) + (data.approvals?.pending ?? 0),
    work: (board?.todo || 0) + (board?.doing || 0),
  });
}

export default function LeaderVoiceAssistant({ data }) {
  const { lang, tr } = useLang();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => () => {
    recognitionRef.current?.stop?.();
    window.speechSynthesis?.cancel?.();
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else {
      recognitionRef.current?.stop?.();
      window.speechSynthesis?.cancel?.();
      setListening(false);
      setSpeaking(false);
    }
  }, [open]);

  const ask = (text = question) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setAnswer(makeAnswer(trimmed, data, tr));
    setVoiceError('');
    window.speechSynthesis?.cancel?.();
    setSpeaking(false);
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setVoiceError(tr('voice.unsupported')); return; }
    setVoiceError('');
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'te' ? 'te-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => ask(event.results[0][0].transcript);
    recognition.onerror = () => setVoiceError(tr('voice.micError'));
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const speakAnswer = () => {
    if (!answer || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(answer);
    utterance.lang = lang === 'te' ? 'te-IN' : 'en-IN';
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="relative">
      <Button type="button" variant="outline" size="sm" className="gap-2 border-orange-200 bg-white text-slate-800 hover:border-orange-300 hover:bg-orange-50" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Sparkles className="size-4 text-orange-600" aria-hidden="true" />
        <span>{tr('voice.button')}</span>
      </Button>
      {open && (
        <section role="dialog" aria-label={tr('voice.title')} className="absolute right-0 top-full z-50 mt-2 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_18px_55px_rgba(15,23,42,.2)]">
          <header className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-r from-orange-50 via-white to-emerald-50 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-orange-700 shadow-sm ring-1 ring-orange-100"><AudioLines className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">{tr('voice.title')}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{tr('voice.description')}</p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={tr('voice.close')} onClick={() => setOpen(false)}><X className="size-4" /></Button>
          </header>

          <div className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              {['urgent', 'approvals', 'work'].map((topic) => (
                <button key={topic} type="button" onClick={() => ask(tr(`voice.prompt.${topic}`))} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">{tr(`voice.prompt.${topic}`)}</button>
              ))}
            </div>

            <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); ask(); }}>
              <label htmlFor="leader-voice-question" className="sr-only">{tr('voice.inputLabel')}</label>
              <input ref={inputRef} id="leader-voice-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={tr('voice.placeholder')} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
              <Button type="submit" size="icon" aria-label={tr('voice.ask')} disabled={!question.trim()}><Send className="size-4" /></Button>
            </form>

            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant={listening ? 'destructive' : 'outline'} size="sm" onClick={listening ? () => recognitionRef.current?.stop?.() : startListening}>
                {listening ? <><MicOff className="size-4" />{tr('voice.listening')}</> : <><Mic className="size-4" />{tr('voice.speak')}</>}
              </Button>
              <span className="text-right text-[11px] text-slate-500">{tr('voice.dataNote')}</span>
            </div>

            {voiceError && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{voiceError}</p>}
            {answer && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3.5" aria-live="polite">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">{tr('voice.answerLabel')}</p>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={speaking ? tr('voice.stopSpeaking') : tr('voice.readAnswer')} onClick={speaking ? () => { window.speechSynthesis?.cancel?.(); setSpeaking(false); } : speakAnswer}>
                    {speaking ? <MicOff className="size-4" /> : <Volume2 className="size-4" />}
                  </Button>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-800">{answer}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
