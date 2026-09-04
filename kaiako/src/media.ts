export function isImageFile(name: string): boolean {
	const ext = name.split(".").pop()?.toLowerCase() ?? "";
	return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);
}
