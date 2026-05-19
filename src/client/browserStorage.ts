import type { StorageProvider } from "./storage";

export const browserVisitorStorage: StorageProvider = {
	getItem(key: string) {
		return localStorage.getItem(key);
	},
	setItem(key: string, value: string) {
		localStorage.setItem(key, value);
	},
};

export const browserSessionStorage: StorageProvider = {
	getItem(key: string) {
		return sessionStorage.getItem(key);
	},
	setItem(key: string, value: string) {
		sessionStorage.setItem(key, value);
	},
};
