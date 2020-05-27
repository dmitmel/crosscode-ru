// useful links:
// https://github.com/uisky/notabenoid

import { fetchDocument } from './utils/http.js';
import { Fetcher } from './utils/async.js';

const BOOK_ID = '74823';

const RU_ABBREVIATED_MONTH_NAMES = [
  'янв.',
  'февр.',
  'марта',
  'апр.',
  'мая',
  'июня',
  'июля',
  'авг.',
  'сент.',
  'окт.',
  'нояб.',
  'дек.',
];

// I hope this doesn't get changed... although, the latest commit on Nota's
// repo is from 2016, so such changes are very unlikely.
const CHAPTER_PAGE_SIZE = 50;

export type ChapterStatuses = Record<string, ChapterStatus>;

export interface ChapterStatus {
  id: string;
  name: string;
  fetchTimestamp: number;
  modificationTimestamp: number;
  translatedFragments: number;
  totalFragments: number;
}

export interface Chapter extends ChapterStatus {
  fragments: Fragment[];
}

export interface Fragment {
  id: string;
  orderNumber: number;
  original: Original;
  translations: Translation[];
}

export interface Original {
  rawContent: string;
  file: string;
  jsonPath: string;
  langUid: number | null;
  descriptionText: string;
  text: string;
}

export interface Translation {
  id: string;
  rawText: string;
  text: string;
  authorUsername: string;
  votes: number;
  score: number;
  timestamp: Date;
  flags: Record<string, boolean | string>;
}

export class NotaClient {
  constructor(readonly options: { anonymous: boolean }) {}

  private async makeRequest(path: string): Promise<Document> {
    let url = new URL(
      path,
      this.options.anonymous
        ? 'https://opennota2.duckdns.org'
        : 'http://notabenoid.org',
    );
    let doc = await fetchDocument(url);

    if (
      doc.querySelector(
        'form[method="post"][action="/"] input[name^="login"]',
      ) != null
    ) {
      throw new Error('authentication required');
    }

    return doc;
  }

  async fetchAllChapterStatuses(): Promise<ChapterStatuses> {
    let doc = await this.makeRequest(`/book/${BOOK_ID}`);
    let result: ChapterStatuses = {};
    for (let tr of doc.querySelectorAll<HTMLElement>(
      '#Chapters > tbody > tr',
    )) {
      let chapterStatus = parseChapterStatus(tr);
      if (chapterStatus != null) result[chapterStatus.name] = chapterStatus;
    }
    return result;
  }

  createChapterFragmentFetcher(status: ChapterStatus): Fetcher<Fragment[]> {
    let pages = Math.ceil(status.totalFragments / CHAPTER_PAGE_SIZE);
    // seriously... JS has regular generator functions, yet it doesn't have
    // GENERATOR ARROW FUNCTIONS! I guess I have to use this old pattern again.
    let self = this;
    return {
      total: pages,
      iterator: (function* (): Iterator<Promise<Fragment[]>> {
        for (let i = 0; i < pages; i++) {
          console.log(`${status.name}, page ${i + 1}/${pages}`);
          yield self
            .makeRequest(`/book/${BOOK_ID}/${status.id}?Orig_page=${i + 1}`)
            .then(doc => {
              let fragments: Fragment[] = [];
              for (let tr of doc.querySelectorAll('#Tr > tbody > tr')) {
                let f = parseFragment(tr);
                if (f != null) fragments.push(f);
              }
              return fragments;
            });
        }
      })(),
    };
  }

  async login(username: string, password: string): Promise<void> {
    let body = new FormData();
    body.append('login[login]', username);
    body.append('login[pass]', password);
    await fetch('http://notabenoid.org/', {
      method: 'POST',
      body,
      credentials: 'include',
    });
  }
}

function parseChapterStatus(element: HTMLElement): ChapterStatus | null {
  let cs: Partial<ChapterStatus> = {};
  // TODO: test the difference between this and the 'Date' HTTP header on slow
  // Internet connections
  cs.fetchTimestamp = Date.now();

  let { id } = element.dataset;
  if (id == null) return null;
  cs.id = id;
  let anchor = element.querySelector(':scope > td:nth-child(1) > a');
  if (anchor == null) return null;
  let activityElem = element.querySelector<HTMLElement>(
    ':scope > td:nth-child(3) > span',
  );
  if (activityElem == null) return null;
  let doneElem = element.querySelector<HTMLElement>(
    ':scope > td:nth-child(4) > small',
  );
  if (doneElem == null) return null;

  cs.name = anchor.textContent!;

  let match = /(\d+) ([а-я.]+) (\d+) г., (\d+):(\d+)/.exec(activityElem.title);
  if (match == null || match.length !== 6) return null;
  let [day, month, year, hour, minute] = match.slice(1);
  let [dayN, yearN, hourN, minuteN] = [day, year, hour, minute].map(s =>
    parseInt(s, 10),
  );
  let monthIndex = RU_ABBREVIATED_MONTH_NAMES.indexOf(month);
  if (monthIndex < 0) return null;
  cs.modificationTimestamp = new Date(
    Date.UTC(yearN, monthIndex, dayN, hourN - 3, minuteN),
  ).getTime();

  match = /\((\d+) \/ (\d+)\)/.exec(doneElem.textContent!);
  if (match == null || match.length !== 3) return null;
  let [translatedFragments, totalFragments] = match
    .slice(1)
    .map(s => parseInt(s, 10));
  cs.translatedFragments = translatedFragments;
  cs.totalFragments = totalFragments;

  return cs as ChapterStatus;
}

function parseFragment(element: Element): Fragment | null {
  if (element.id.length <= 1) return null;
  let text = element.querySelector('.o .text');
  if (text == null) return null;
  let anchor = element.querySelector<HTMLAnchorElement>('.o a.ord');
  if (anchor == null || anchor.textContent!.length <= 1) return null;

  let f: Partial<Fragment> = {};
  f.id = element.id.slice(1);
  f.orderNumber = parseInt(anchor.textContent!.slice(1), 10);

  let original = parseOriginal(text.textContent!);
  if (original == null) return null;
  f.original = original;

  let translations: Translation[] = [];
  f.translations = translations;
  for (let translationElement of element.querySelectorAll('.t > div')) {
    let t = parseTranslation(translationElement);
    if (t != null) translations.push(t);
  }
  f.translations.sort((a, b) => b.score - a.score);

  return f as Fragment;
}

function parseOriginal(raw: string): Original | null {
  if (raw.startsWith('----')) return null;

  let o: Partial<Original> = {};
  o.rawContent = raw;

  let headersLen = raw.indexOf('\n\n');
  if (headersLen < 0) return null;
  let headers = raw.slice(0, headersLen);
  let locationLineLen = headers.indexOf('\n');
  if (locationLineLen < 0) locationLineLen = headers.length;
  let locationLine = headers.slice(0, locationLineLen);

  let langUidMarkerIndex = locationLine.lastIndexOf(' #');
  if (langUidMarkerIndex >= 0) {
    o.langUid = parseInt(locationLine.slice(langUidMarkerIndex + 2), 10);
    locationLine = locationLine.slice(0, langUidMarkerIndex);
  }
  let firstSpaceIndex = locationLine.indexOf(' ');
  if (firstSpaceIndex < 0) return null;
  o.file = locationLine.slice(0, firstSpaceIndex);
  o.jsonPath = locationLine.slice(firstSpaceIndex + 1);

  o.descriptionText = raw.slice(locationLineLen + 1, headersLen);
  o.text = raw.slice(headersLen + 2);

  return o as Original;
}

function parseTranslation(element: Element): Translation | null {
  let t: Partial<Translation> = {};
  t.id = element.id.slice(1);
  t.rawText = element.querySelector('.text')!.textContent!;
  t.authorUsername = element.querySelector('.user')!.textContent!;
  t.votes = parseInt(
    element.querySelector('.rating .current')!.textContent!,
    10,
  );
  t.score = 0;

  let match = /(\d+).(\d+).(\d+) в (\d+):(\d+)/.exec(
    element.querySelector('.info .icon-flag')!.nextSibling!.textContent!,
  );
  if (match == null || match.length !== 6) return null;
  let [day, month, year, hour, minute] = match
    .slice(1)
    .map(s => parseInt(s, 10));
  t.timestamp = new Date(
    Date.UTC(2000 + year, month - 1, day, hour - 3, minute),
  );

  let flags: Record<string, boolean | string> = {};
  t.text = t.rawText
    .replace(/\n?⟪(.*)⟫\s*/, (_match: string, group: string) => {
      for (let s of group.split('|')) {
        s = s.trim();
        let i = s.indexOf(':');
        if (i >= 0) {
          flags[s.slice(0, i)] = s.slice(i + 1);
        } else {
          flags[s] = true;
        }
      }
      return '';
    })
    .replace(/^\^|^\$|\$$/g, '');
  t.flags = flags;

  t.score = calculateTranslationScore(t as Translation);
  return t as Translation;
}

function calculateTranslationScore(t: Translation): number {
  let score = 1e10 + 1e10 * t.votes + t.timestamp.getTime() / 1000 - 19e8;
  if (t.authorUsername === 'p_zombie') score -= 1e9;
  if (t.authorUsername === 'DimavasBot') {
    score -= 3e9;
    if (t.flags.fromGTable && !t.flags.notChecked) score += 1e9;
  }
  return score;
}
