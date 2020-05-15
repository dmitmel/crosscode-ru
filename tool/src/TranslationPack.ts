import * as Nota from './Notabenoid';

import path from './node-builtin-modules/path.js';
import * as fsUtils from './utils/fs.js';

type LocalizeMePack = Record<string, { orig: string; text: string }>;

const INJECTED_IN_MOD_TAG = 'INJECTED_IN_MOD';
const IGNORE_IN_MOD_TAG = 'IGNORE_IN_MOD';

export class LocalizeMePacker {
  packs: Map<string, LocalizeMePack> = new Map();
  private assetsCache: Map<string, unknown> = new Map();

  async addNotaFragments(fragments: Nota.Fragment[]): Promise<void> {
    for (let f of fragments) {
      if (f.translations.length === 0) continue;
      if (f.original.descriptionText.includes(IGNORE_IN_MOD_TAG)) continue;

      // eslint-disable-next-line no-await-in-loop
      if (!(await this.validateFragment(f))) continue;

      let pack: LocalizeMePack;
      let { file } = f.original;
      if (this.packs.has(file)) {
        pack = this.packs.get(file)!;
      } else {
        pack = {};
        this.packs.set(file, pack);
      }
      pack[`${file}/${f.original.jsonPath}`] = {
        orig: f.original.text,
        text: f.translations[0].text,
      };
    }
  }

  async validateFragment(f: Nota.Fragment): Promise<boolean> {
    let { file, jsonPath } = f.original;

    let obj: unknown;
    try {
      obj = await this.getAsset(file);
    } catch (_err) {
      console.warn(`${file} ${jsonPath}: unknown file`);
      return false;
    }

    if (!f.original.descriptionText.includes(INJECTED_IN_MOD_TAG)) {
      let jsonPathComponents = jsonPath.split('/');
      for (let key of jsonPathComponents) {
        obj = (obj as Record<string, unknown>)[key];
      }

      let realOriginalText: string;
      if (file.endsWith('.en_US.json')) {
        if (typeof obj !== 'string') {
          console.warn(`${file} ${jsonPath}: not a string`);
          return false;
        }
        realOriginalText = obj;
      } else {
        if (typeof obj !== 'object' || obj == null) {
          console.warn(`${file} ${jsonPath}: not a string`);
          return false;
        }
        let obj2 = obj as { en_US?: unknown };
        if (typeof obj2.en_US !== 'string') {
          console.warn(`${file} ${jsonPath}: not a string`);
          return false;
        }
        realOriginalText = obj2.en_US;
      }

      if (f.original.text !== realOriginalText) {
        console.warn(`${file} ${jsonPath}: stale translation`);
      }
    }

    return true;
  }

  private async getAsset(file: string): Promise<unknown> {
    if (this.assetsCache.has(file)) {
      return this.assetsCache.get(file);
    } else {
      let data = await fsUtils.readJsonFile(path.join('assets', 'data', file));
      this.assetsCache.set(file, data);
      return data;
    }
  }
}
