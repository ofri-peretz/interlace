/**
 * @interlace/ui — PhotoUpload XHR adapter
 *
 * An optional `onUpload` built on XMLHttpRequest, because `fetch` cannot report
 * upload progress. PhotoUpload does not import this file: it is a subpath the
 * app opts into, and the one place in the family that opens a connection.
 *
 *   <PhotoUpload onUpload={xhrUploader('/api/photos', { field: 'photo' })} />
 *
 * 5xx and network errors are retryable; 4xx is not (auth is flagged as such).
 */
import { PhotoUploadError, type PhotoUploader } from './photo-upload-model.js';

export interface XhrUploaderInit {
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  /** Send as multipart form data under this field name; absent sends the raw bytes. */
  field?: string;
  withCredentials?: boolean;
  /** Turns the response body into the item's `result`. @default the parsed JSON, else the text */
  parse?: (xhr: XMLHttpRequest) => unknown;
}

export function xhrUploader(url: string, init: XhrUploaderInit = {}): PhotoUploader {
  return (photo, ctx) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(init.method ?? 'POST', url);
      xhr.withCredentials = init.withCredentials ?? false;
      for (const [k, v] of Object.entries(init.headers ?? {})) xhr.setRequestHeader(k, v);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) ctx.onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (init.parse) return resolve(init.parse(xhr));
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(xhr.responseText);
          }
          return;
        }
        const auth = xhr.status === 401 || xhr.status === 403;
        reject(
          new PhotoUploadError(`The server answered ${xhr.status}`, {
            retryable: xhr.status >= 500 || xhr.status === 429,
            code: auth ? 'auth' : xhr.status >= 500 ? 'server' : 'rejected',
          }),
        );
      };
      xhr.onerror = () => reject(new PhotoUploadError('The connection dropped', { retryable: true, code: 'network' }));
      xhr.onabort = () => reject(new DOMException('aborted', 'AbortError'));
      ctx.signal.addEventListener('abort', () => xhr.abort(), { once: true });
      if (ctx.signal.aborted) return xhr.abort();
      if (init.field) {
        const form = new FormData();
        form.append(init.field, photo.blob, 'photo');
        xhr.send(form);
      } else xhr.send(photo.blob);
    });
}
