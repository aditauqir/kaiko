import { limitTopicWords } from "./config";

const TOPIC_MARKER = /<!--\s*kaiako-topic\s*:\s*([^>]*?)\s*-->/i;
const TOPIC_MARKER_OR_PARTIAL = /<!--\s*kaiako-topic\b[\s\S]*?(?:-->|$)/i;

export function extractTopic(markdown: string): string | null {
	const match = markdown.match(TOPIC_MARKER);
	if (!match?.[1]) return null;
	const topic = limitTopicWords(match[1].replace(/[*_`#]/g, " "));
	return topic === "Chat" ? null : topic;
}

export function stripTopicMarker(markdown: string): string {
	return markdown.replace(TOPIC_MARKER_OR_PARTIAL, "").replace(/^\s+/, "").trim();
}
