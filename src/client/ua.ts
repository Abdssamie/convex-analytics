export interface UAResult {
	browser: string;
	os: string;
	device: string;
}

export function parseUA(ua: string): UAResult {
	if (!ua) {
		return {
			browser: "Unknown",
			os: "Unknown",
			device: "Desktop",
		};
	}

	const browser = parseBrowser(ua);
	const os = parseOS(ua);
	const device = parseDevice(ua, os);
	return { browser, os, device };
}

function parseBrowser(ua: string): string {
	if (/bot|crawl|spider|slurp|googlebot/i.test(ua)) return "Bot";
	if (/Edg\//.test(ua)) return "Edge";
	if (/OPR\/|Opera/.test(ua)) return "Opera";
	if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
	if (/UCBrowser/.test(ua)) return "UC Browser";
	if (/Brave/.test(ua)) return "Brave";
	if (/Vivaldi/.test(ua)) return "Vivaldi";
	if (/Firefox\//.test(ua)) return "Firefox";
	if (/CriOS\//.test(ua)) return "Chrome";
	if (/Chrome\//.test(ua)) return "Chrome";
	if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari";
	if (/MSIE|Trident/.test(ua)) return "IE";
	return "Other";
}

function parseOS(ua: string): string {
	if (/iPad|iPhone|iPod/.test(ua)) return "iOS";
	if (/Android/.test(ua)) return "Android";
	if (/Windows NT/.test(ua)) return "Windows";
	if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
	if (/CrOS/.test(ua)) return "Chrome OS";
	if (/Linux/.test(ua)) return "Linux";
	return "Other";
}

function parseDevice(ua: string, os: string): string {
	if (/iPad/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) {
		return "Tablet";
	}
	if (os === "iOS" || os === "Android" || /Mobile/.test(ua)) {
		return "Mobile";
	}
	return "Desktop";
}
