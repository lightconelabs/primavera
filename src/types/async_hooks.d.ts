declare module 'async_hooks' {
	export class AsyncLocalStorage<T = unknown> {
		disable(): void;
		enterWith(store: T): void;
		exit<R>(callback: (...args: any[]) => R, ...args: any[]): R;
		getStore(): T | undefined;
		run<R>(store: T, callback: (...args: any[]) => R, ...args: any[]): R;
	}
}
