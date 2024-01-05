import { Events } from "discord.js";

export const execute = async (client) => {
    console.log(`Logged in as ${client.user.tag}!`);
};

export const name = Events.ClientReady;
export const once = true;
