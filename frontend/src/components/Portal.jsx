import React, { useMemo, useState } from 'react';
import Logo from './Logo';

/*
 * Public front page in the style of a Telugu news portal (dense, headline-first).
 * Every story here is SAMPLE content for the client demo and is labelled as such on the page.
 * Nothing on this page comes from the database or names a real event.
 */

const SEGMENTS = ['Medchal', 'Malkajgiri', 'Quthbullapur', 'Kukatpally', 'Uppal', 'L.B. Nagar', 'Secunderabad Cantt.'];

const TABS = [
  { id: 'all', en: 'Latest', te: 'తాజా' },
  { id: 'civic', en: 'Civic', te: 'ప్రజా సమస్యలు' },
  { id: 'dev', en: 'Development', te: 'అభివృద్ధి' },
  { id: 'politics', en: 'Politics', te: 'రాజకీయం' },
  { id: 'edu', en: 'Education', te: 'విద్య' },
  { id: 'health', en: 'Health', te: 'ఆరోగ్యం' },
  { id: 'transport', en: 'Transport', te: 'రవాణా' },
];

const S = [
  { id: 1, cat: 'dev', seg: 'Medchal', ago: 12, te: 'మేడ్చల్: తాగునీటి పైప్‌లైన్ పనులు రెండు దశల్లో పూర్తి', en: 'Medchal: drinking-water pipeline works to finish in two phases', te2: 'కాలనీలకు నీటి సరఫరా మెరుగుపడనుందని అధికారులు తెలిపారు.', en2: 'Officials say supply to several colonies will improve once the first phase ends.' },
  { id: 2, cat: 'civic', seg: 'Kukatpally', ago: 25, te: 'కూకట్‌పల్లి: వర్షం తర్వాత రోడ్లపై గుంతలు, వాహనదారుల ఇబ్బందులు', en: 'Kukatpally: potholes after rain trouble commuters on main roads', te2: 'మరమ్మతులు త్వరగా చేపట్టాలని స్థానికులు కోరుతున్నారు.', en2: 'Residents want repair work started without delay.' },
  { id: 3, cat: 'transport', seg: 'Uppal', ago: 41, te: 'ఉప్పల్: ట్రాఫిక్ రద్దీ తగ్గించేందుకు కొత్త సిగ్నల్ ఏర్పాట్లు', en: 'Uppal: new signal plan aims to ease junction congestion', te2: 'పీక్ అవర్స్‌లో రద్దీ ఎక్కువగా ఉండే చోట్ల ప్రయోగాత్మకంగా అమలు.', en2: 'Trial to run first at junctions that jam during peak hours.' },
  { id: 4, cat: 'edu', seg: 'Quthbullapur', ago: 58, te: 'కుత్బుల్లాపూర్: ప్రభుత్వ పాఠశాలల్లో డిజిటల్ తరగతులు', en: 'Quthbullapur: government schools get digital classrooms', te2: 'తొలి దశలో ఎంపిక చేసిన పాఠశాలలకు పరికరాలు అందజేత.', en2: 'Equipment handed over to selected schools in the first phase.' },
  { id: 5, cat: 'health', seg: 'L.B. Nagar', ago: 75, te: 'ఎల్బీ నగర్: ప్రభుత్వ ఆసుపత్రిలో ఉచిత ఆరోగ్య శిబిరం', en: 'L.B. Nagar: free health camp at the government hospital', te2: 'బీపీ, షుగర్ పరీక్షలు ఉచితంగా అందుబాటులో ఉంటాయి.', en2: 'BP and sugar tests will be available free of charge.' },
  { id: 6, cat: 'civic', seg: 'Malkajgiri', ago: 96, te: 'మల్కాజిగిరి: డ్రైనేజీ ఓవర్‌ఫ్లోపై కాలనీవాసుల ఫిర్యాదు', en: 'Malkajgiri: colony residents complain of drain overflow', te2: 'శుభ్రపరిచే పనులు వారానికి ఒకసారి చేయాలని విజ్ఞప్తి.', en2: 'They ask for cleaning to be done at least once a week.' },
  { id: 7, cat: 'dev', seg: 'Secunderabad Cantt.', ago: 130, te: 'సికింద్రాబాద్ కంటోన్మెంట్: రోడ్డు విస్తరణపై ప్రజాభిప్రాయం', en: 'Secunderabad Cantt.: public views sought on road widening', te2: 'స్థానికుల సూచనలను పరిశీలిస్తామని అధికారులు చెప్పారు.', en2: 'Officials say local suggestions will be studied.' },
  { id: 8, cat: 'politics', seg: 'Malkajgiri', ago: 170, te: 'మల్కాజిగిరి లోక్‌సభ పరిధిలో బూత్ స్థాయి సమావేశాలు', en: 'Booth-level meetings held across the Malkajgiri Lok Sabha area', te2: 'కార్యకర్తలతో సమన్వయ సమావేశాలు నిర్వహించారు.', en2: 'Coordination meetings were held with party workers.' },
  { id: 9, cat: 'transport', seg: 'Kukatpally', ago: 210, te: 'మెట్రో స్టేషన్ల వద్ద పార్కింగ్ సమస్యపై ప్రయాణికుల అసంతృప్తి', en: 'Commuters unhappy about parking near metro stations', te2: 'అదనపు పార్కింగ్ స్థలం కేటాయించాలని డిమాండ్.', en2: 'Demand for extra parking space near the stations.' },
  { id: 10, cat: 'edu', seg: 'Uppal', ago: 260, te: 'ఉప్పల్: విద్యార్థులకు కెరీర్ గైడెన్స్ కార్యక్రమం', en: 'Uppal: career guidance session for students', te2: 'పదో తరగతి, ఇంటర్ విద్యార్థులకు అవగాహన తరగతులు.', en2: 'Awareness classes for Class 10 and intermediate students.' },
  { id: 11, cat: 'health', seg: 'Medchal', ago: 330, te: 'మేడ్చల్: డెంగ్యూ నివారణకు పారిశుధ్య చర్యలు ముమ్మరం', en: 'Medchal: sanitation drive stepped up to prevent dengue', te2: 'ఇంటింటి సర్వే కొనసాగుతోంది.', en2: 'A house-to-house survey is under way.' },
  { id: 12, cat: 'civic', seg: 'Quthbullapur', ago: 420, te: 'కుత్బుల్లాపూర్: వీధి దీపాలు వెలగడం లేదని ఫిర్యాదులు', en: 'Quthbullapur: complaints about street lights not working', te2: 'మరమ్మతు చేయాలని అధికారులకు వినతి.', en2: 'Residents petition officials for repairs.' },
];

const when = (m, te) => (m < 60 ? (te ? `${m} నిమిషాల క్రితం` : `${m} min ago`) : (te ? `${Math.floor(m / 60)} గంటల క్రితం` : `${Math.floor(m / 60)} h ago`));

function Tile({ cat, seg, large }) {
  // Flat tinted block instead of a photo: no real images are used in the demo.
  const tone = { dev: 'bg-[#E3ECF8]', civic: 'bg-[#FBEBD6]', politics: 'bg-[#E4E8EF]', edu: 'bg-[#E1F1EA]', health: 'bg-[#F6E3E3]', transport: 'bg-[#E8E6F4]' }[cat] || 'bg-[#E4E8EF]';
  return (
    <div className={`${tone} flex items-end p-3 ${large ? 'aspect-[21/9]' : 'aspect-[4/3]'} w-full`} aria-hidden="true">
      <span className="text-[11px] font-semibold tracking-wide text-[#0B2545]/70">{seg}</span>
    </div>
  );
}

export default function Portal() {
  const [te, setTe] = useState(true);
  const [tab, setTab] = useState('all');
  const [seg, setSeg] = useState('All');

  const list = useMemo(() => S.filter(s => (tab === 'all' || s.cat === tab) && (seg === 'All' || s.seg === seg)), [tab, seg]);
  const lead = list[0];
  const side = list.slice(1, 4);
  const rest = list.slice(4);
  const h = (s) => (te ? s.te : s.en);
  const b = (s) => (te ? s.te2 : s.en2);
  const today = new Date().toLocaleDateString(te ? 'te-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="shadcn-scope min-h-screen bg-white text-[#0F1B2D]" style={{ fontFamily: "'Public Sans','Noto Sans Telugu',system-ui,sans-serif" }}>
      <div className="bg-[#B45309] px-4 py-1.5 text-center text-xs font-medium text-white">
        {te ? 'ఇది డెమో పేజీ. ఇందులోని వార్తలు నమూనా మాత్రమే.' : 'Demo page. Every story here is sample content, not real news.'}
      </div>

      <div className="border-b border-[#DDE3EC]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-1.5 text-xs text-[#5B6B80]">
          <span>{today}</span>
          <span className="flex items-center gap-3">
            <button type="button" onClick={() => setTe(v => !v)} className="font-medium text-[#17408B] hover:underline">{te ? 'English' : 'తెలుగు'}</button>
            <a href="/" className="rounded-md bg-[#0B2545] px-3 py-1 font-medium text-white hover:bg-[#17408B]">{te ? 'లాగిన్' : 'Login'}</a>
          </span>
        </div>
      </div>

      <header className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-4">
        <Logo className="size-11" />
        <div>
          <p className="text-3xl font-extrabold tracking-tight text-[#0B2545]">Nayak</p>
          <p className="text-xs text-[#5B6B80]">{te ? 'మల్కాజిగిరి లోక్‌సభ వార్తా కేంద్రం' : 'Malkajgiri Lok Sabha news desk'}</p>
        </div>
      </header>

      <nav aria-label={te ? 'విభాగాలు' : 'Sections'} className="sticky top-0 z-10 border-y border-[#0B2545] bg-[#0B2545]">
        <ul className="mx-auto flex max-w-[1400px] list-none gap-1 overflow-x-auto px-3">
          {TABS.map(x => (
            <li key={x.id}>
              <button type="button" onClick={() => setTab(x.id)} aria-current={tab === x.id ? 'page' : undefined}
                className={`whitespace-nowrap px-3 py-3 text-sm font-semibold ${tab === x.id ? 'bg-white text-[#0B2545]' : 'text-white/85 hover:text-white'}`}>
                {te ? x.te : x.en}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-b border-[#DDE3EC] bg-[#F6F8FB]">
        <ul className="mx-auto flex max-w-[1400px] list-none gap-2 overflow-x-auto px-4 py-2.5 text-sm">
          {['All', ...SEGMENTS].map(x => (
            <li key={x}>
              <button type="button" onClick={() => setSeg(x)} aria-pressed={seg === x}
                className={`whitespace-nowrap rounded-full border px-3 py-1 ${seg === x ? 'border-[#17408B] bg-[#17408B] text-white' : 'border-[#DDE3EC] bg-white text-[#0F1B2D] hover:border-[#17408B]'}`}>
                {x === 'All' ? (te ? 'అన్ని నియోజకవర్గాలు' : 'All constituencies') : x}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        {!lead ? (
          <p className="py-16 text-center text-[#5B6B80]">{te ? 'ఈ విభాగంలో నమూనా వార్తలు లేవు.' : 'No sample stories in this section.'}</p>
        ) : (
          <>
            <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]" aria-label={te ? 'ప్రధాన వార్తలు' : 'Top stories'}>
              <article>
                <Tile cat={lead.cat} seg={lead.seg} large />
                <p className="mt-3 text-xs font-semibold uppercase text-[#B45309]">{lead.seg} · {when(lead.ago, te)}</p>
                <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight">{h(lead)}</h1>
                <p className="mt-2 text-base leading-relaxed text-[#5B6B80]">{b(lead)}</p>
              </article>

              <div className="divide-y divide-[#DDE3EC] border-t border-[#0B2545] lg:border-l lg:border-t-0 lg:pl-6">
                {side.map(s => (
                  <article key={s.id} className="py-4 first:pt-3">
                    <p className="text-xs text-[#5B6B80]">{s.seg} · {when(s.ago, te)}</p>
                    <h2 className="mt-1 text-lg font-bold leading-snug">{h(s)}</h2>
                  </article>
                ))}
              </div>
            </section>

            {rest.length > 0 && (
              <section className="mt-10" aria-label={te ? 'మరిన్ని వార్తలు' : 'More stories'}>
                <h2 className="border-b-2 border-[#0B2545] pb-2 text-lg font-extrabold text-[#0B2545]">{te ? 'మరిన్ని వార్తలు' : 'More stories'}</h2>
                <div className="mt-5 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                  {rest.map(s => (
                    <article key={s.id}>
                      <Tile cat={s.cat} seg={s.seg} />
                      <p className="mt-2 text-xs text-[#5B6B80]">{when(s.ago, te)}</p>
                      <h3 className="mt-0.5 text-base font-bold leading-snug">{h(s)}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-[#5B6B80]">{b(s)}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="mt-10 border-t border-[#DDE3EC] bg-[#F6F8FB]">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-[#5B6B80]">
          <span>Nayak · {te ? 'డెమో. నమూనా కంటెంట్' : 'Demo with sample content'}</span>
          <a href="/" className="font-medium text-[#17408B] hover:underline">{te ? 'నాయకుల లాగిన్' : 'Leader and staff login'}</a>
        </div>
      </footer>
    </div>
  );
}
