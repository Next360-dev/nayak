import React, { useState } from 'react';
import { Languages, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { deduplicateSources, isTextTelugu, classifyArticleSentiment } from '../utils/constants';
import { translateArticle } from '../utils/api';
import ReportMenu from './ReportMenu';

/** One story in the feed: headline first, a quiet line for tags/place/time, the summary, then the actions. */
export default function NewsCard({ art, currentLang, t, onOpenOutletsModal, onShare }) {
  const te = currentLang === 'te';
  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedHeadline, setTranslatedHeadline] = useState('');
  const [translatedSummary, setTranslatedSummary] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState('');

  const pScore = Number(art.priority_score) || 3;
  const formattedDate = art.date_time
    ? new Date(art.date_time).toLocaleString(te ? 'te-IN' : 'en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : (te ? 'ఇటీవల' : 'Recent');

  const rawSources = Array.isArray(art.sources) && art.sources.length > 0
    ? art.sources
    : [{ publisher: art.newspaper_name || 'News Source', url: art.url || '#' }];
  const sourcesList = deduplicateSources(rawSources);
  const primarySource = (sourcesList && sourcesList.length > 0) ? sourcesList[0] : { publisher: art.newspaper_name || 'News Source', url: art.url || '#' };
  const extraOutletsCount = Math.max(0, sourcesList.length - 1);

  const dist = art.district_name && art.district_name !== 'Statewide' ? art.district_name : '';
  const cons = art.constituency_name && art.constituency_name !== 'Statewide' ? art.constituency_name : '';
  const place = [cons, dist && dist.toLowerCase() !== cons.toLowerCase() ? dist : ''].filter(Boolean).join(' · ') || (t.statewide || 'Statewide');

  const sentiment = art.sentiment || classifyArticleSentiment(art);
  const isSocial = art.is_social || art.news_type === 'social';

  const isTel = isTextTelugu(art.headline);

  const handleToggleTranslation = async () => {
    setTranslateError('');
    if (isTranslated) { setIsTranslated(false); return; }
    if (translatedHeadline) { setIsTranslated(true); return; }
    setIsTranslating(true);
    try {
      const data = await translateArticle(art.headline, art.summary);
      if (data.status === 'success' && data.data) {
        setTranslatedHeadline(data.data.translated_headline || art.headline);
        setTranslatedSummary(data.data.translated_summary || art.summary || '');
        setIsTranslated(true);
      } else {
        setTranslateError(te ? 'అనువాద సేవ ఇప్పుడు బిజీగా ఉంది. మళ్లీ ప్రయత్నించండి.' : 'Translation is busy right now. Try again in a moment.');
      }
    } catch (err) {
      setTranslateError(te ? 'అనువాద సేవకు కనెక్ట్ కాలేదు.' : 'Could not reach the translation service.');
    } finally {
      setIsTranslating(false);
    }
  };

  const headline = isTranslated ? (translatedHeadline || art.headline) : art.headline;
  const rawSummary = isTranslated ? (translatedSummary || art.summary) : (art.summary || '');
  // Many summaries are just the headline plus the publisher name; showing them adds nothing.
  const same = (a, b) => a.trim().toLowerCase().slice(0, 40) === b.trim().toLowerCase().slice(0, 40);
  const summary = rawSummary && same(rawSummary, headline) && rawSummary.length < headline.length + 60 ? '' : rawSummary;

  return (
    <article className="space-y-2.5 px-5 py-5" id={`article-card-${art.id}`}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {pScore === 1 && <Badge variant="destructive">{te ? 'అత్యవసరం' : 'Urgent'}</Badge>}
        {pScore === 2 && <Badge variant="secondary">{te ? 'ప్రజా సమస్య' : 'Civic'}</Badge>}
        {isSocial && <Badge variant="outline">{te ? 'సోషల్ మీడియా' : 'Social media'}</Badge>}
        {sentiment === 'negative' && <span className="font-medium text-destructive">{te ? 'ప్రతికూలం' : 'Negative'}</span>}
        {sentiment === 'positive' && <span className="font-medium text-emerald-700">{te ? 'సానుకూలం' : 'Positive'}</span>}
        <span>{place}</span>
        <span>· {formattedDate}</span>
      </p>

      <h2 id={`article-title-${art.id}`} className="text-[17px] font-semibold leading-snug tracking-tight">{headline}</h2>

      {summary && <p id={`article-summary-${art.id}`} className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{summary}</p>}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
        <a href={primarySource.url} target="_blank" rel="noopener noreferrer"
           className="text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
           title={`${te ? 'మూలం తెరవండి' : 'Open source'}: ${primarySource.publisher}`}>
          {primarySource.publisher}
        </a>
        {extraOutletsCount > 0 && (
          <button type="button" onClick={() => onOpenOutletsModal(art)}
                  className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  title={`${te ? 'అన్ని మీడియా సంస్థలు' : 'All media outlets'}: ${sourcesList.length}`}>
            +{extraOutletsCount} {te ? 'ఇతరులు' : 'more'}
          </button>
        )}

        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" variant="ghost" id={`btn-translate-${art.id}`} onClick={handleToggleTranslation} disabled={isTranslating}
                  title={isTel ? 'Translate to English' : 'Translate to Telugu'}>
            <Languages /> {isTranslating ? (te ? 'అనువదిస్తోంది…' : 'Translating…') : isTranslated ? (te ? 'అసలు' : 'Original') : (te ? 'అనువదించు' : 'Translate')}
          </Button>
          <ReportMenu story={art} />
          {onShare && <Button type="button" size="sm" variant="outline" onClick={() => onShare(art)}><Share2 /> {te ? 'షేర్' : 'Share'}</Button>}
        </span>
      </div>
      {translateError && <p role="alert" className="text-sm text-destructive">{translateError}</p>}
    </article>
  );
}
