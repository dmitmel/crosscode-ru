import { NotaHttpClient } from '../Notabenoid.js';

export class NwNotaHttpClient implements NotaHttpClient {
  public async requestJSON<T>(
    method: 'GET' | 'POST',
    url: string,
    body?: Record<string, string> | null,
  ): Promise<T> {
    let res = await fetch(url, { method, body: bodyToFormData(body), credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP error: ${res.status} ${res.statusText}`);
    return await res.json();
  }

  public requestDocument(
    method: 'GET' | 'POST',
    url: string,
    body?: Record<string, string> | null,
  ): Promise<DocumentFragment> {
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.responseType = 'document';

      xhr.onload = () => {
        if (!(200 <= xhr.status && xhr.status < 300)) {
          reject(new Error(`HTTP error: ${xhr.status} ${xhr.statusText}`));
          return;
        }
        let doc = xhr.responseXML;
        if (doc == null) {
          reject(new Error('responseXML is null'));
          return;
        }
        // NOTE: Only types of the field `ownerDocument` are incompatible: for
        // a real document the type is `null` and for a fragment it is another
        // real `Document`.
        resolve(doc as unknown as DocumentFragment);
      };
      xhr.onerror = () => {
        reject(new Error('Network error'));
      };
      xhr.ontimeout = () => {
        reject(new Error('Timeout'));
      };

      xhr.send(bodyToFormData(body));
    });
  }
}

function bodyToFormData(body?: Record<string, string> | null): FormData | null {
  if (body == null) return null;
  let formData = new FormData();
  for (let [k, v] of Object.entries(body)) {
    formData.append(k, v);
  }
  return formData;
}
