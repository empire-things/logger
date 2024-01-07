import { sendMessageToChat } from "../lib/functions.js";
import { sanitize } from "../lib/string.js";
import { Events } from "discord.js";

export const execute = async (event) => {
    const channelIdToUse = "1192924150185066567";

    // Ignore messages from other channels
    if (event.channel.id !== channelIdToUse) return;
    // If author is a bot, ignore
    if (event.author.bot) return;

    const author = event.author;
    const content = event.content;

    // Get user's server nickname
    const nickname = event.member.nickname || author.username;
    const inGameName = nickname.split(" - ")[0] || nickname;

    sendMessageToChat(inGameName, sanitize(content));
};

export const name = Events.MessageCreate;
export const once = false;
