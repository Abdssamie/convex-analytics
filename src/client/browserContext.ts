import type { IngestContext } from "./types";
import { parseUA } from "./ua";

export function getBrowserContext(): IngestContext | undefined {
	if (typeof window === "undefined") {
		return undefined;
	}

	const params = new URLSearchParams(window.location.search);
	const ua = parseUA(window.navigator?.userAgent ?? "");
	return {
		device: ua.device,
		browser: ua.browser,
		os: ua.os,
		utmSource: params.get("utm_source") ?? undefined,
		utmMedium: params.get("utm_medium") ?? undefined,
		utmCampaign: params.get("utm_campaign") ?? undefined,
	};
}

export function getBrowserPath() {
	return globalThis.location?.pathname;
}

export function getBrowserTitle() {
	return globalThis.document?.title;
}

export function getBrowserReferrer() {
	const referrer = globalThis.document?.referrer;
	if (!referrer) {
		return undefined;
	}
	try {
		const referrerUrl = new URL(referrer);
		const currentOrigin = globalThis.location?.origin;
		if (currentOrigin && referrerUrl.origin === currentOrigin) {
			return undefined;
		}
		return referrerUrl.toString();
	} catch {
		return referrer;
	}
}
