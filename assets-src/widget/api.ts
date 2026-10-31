/**
 * REST client for visitor routes. Credentials travel only in the HttpOnly
 * session cookie (same-origin fetch); the CSRF value is sent as a header.
 */
export class ApiError extends Error {
	constructor(public code: string, message: string, public status: number, public data?: Record<string, unknown>) {
		super(message);
	}
}

export class Api {
	csrf = '';
	constructor(private base: string) {}

	async req<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (body !== undefined) headers['Content-Type'] = 'application/json';
		if (method !== 'GET' && this.csrf) headers['X-Televixo-CSRF'] = this.csrf;
		let res: Response;
		try {
			res = await fetch(this.base + path, {
				method,
				headers,
				credentials: 'same-origin',
				cache: 'no-store',
				body: body === undefined ? undefined : JSON.stringify(body),
				signal,
			});
		} catch (e) {
			if ((e as Error).name === 'AbortError') throw e;
			throw new ApiError('network', 'network', 0);
		}
		const text = await res.text();
		let data: unknown = null;
		try { data = text ? JSON.parse(text) : null; } catch { data = null; }
		if (!res.ok) {
			const d = (data || {}) as { code?: string; message?: string; data?: Record<string, unknown> };
			throw new ApiError(d.code || 'http_' + res.status, d.message || '', res.status, d.data);
		}
		return data as T;
	}

	get<T>(path: string, signal?: AbortSignal) { return this.req<T>('GET', path, undefined, signal); }
	post<T>(path: string, body: unknown = {}) { return this.req<T>('POST', path, body); }

	/** Multipart upload with progress and cancellation (XHR). */
	upload(path: string, file: Blob, name: string, onProgress: (p: number) => void): { promise: Promise<any>; abort: () => void } {
		const xhr = new XMLHttpRequest();
		const promise = new Promise((resolve, reject) => {
			xhr.open('POST', this.base + path);
			xhr.withCredentials = true;
			xhr.setRequestHeader('X-Televixo-CSRF', this.csrf);
			xhr.setRequestHeader('Accept', 'application/json');
			xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
			xhr.onload = () => {
				let data: any = null;
				try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
				if (xhr.status >= 200 && xhr.status < 300) resolve(data);
				else reject(new ApiError(data?.code || 'upload_failed', data?.message || '', xhr.status));
			};
			xhr.onerror = () => reject(new ApiError('network', 'network', 0));
			xhr.onabort = () => reject(new ApiError('aborted', 'aborted', 0));
			const fd = new FormData();
			fd.append('file', file, name);
			xhr.send(fd);
		});
		return { promise, abort: () => xhr.abort() };
	}
}
