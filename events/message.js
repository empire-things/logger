import { sendMessageToChat } from "../lib/functions.js";
import { sanitize } from "../lib/string.js";
import { Events } from "discord.js";

export const execute = async (event) => {
    const channelIdToUse = "1192924150185066567";

    // Ignore messages from other channels and bots
    if (event.channel.id !== channelIdToUse || event.author.bot) return;

    const author = event.author;
    const content = event.content;

    // Get user's server nickname
    const nickname = event.member.nickname || author.username;
    const inGameName = nickname.split(" - ")[0] || nickname;

    if (content.match(/[\u{1F000}-\u{1FFFF}]/u)) return;
    sendMessageToChat(inGameName, sanitize(content));
};

export const name = Events.MessageCreate;
export const once = false;
