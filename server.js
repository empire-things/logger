import { Client, Collection, GatewayIntentBits, Partials, ActivityType } from "discord.js";
import { getEventRanking, login } from "./lib/functions.js";
import { sendSms, sendCall } from "./lib/sms-call.js";
import { getTimeString } from "./lib/time.js";
import { getUnits } from "./lib/getData.js";
import { players } from "./data/players.js";
import { sanitize } from "./lib/string.js";
import { server } from "./lib/server.js";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import WebSocket from "ws";
import "dotenv/config";

const username = process.env.USERNAMEE;
const password = process.env.PASSWORD;
const discordToken = process.env.CLIENT_TOKEN;
const useDiscordBot = false;

const chatUrl = process.env.CHAT_URL;
const attacksUrl = process.env.ATTACKS_URL;
const rankingsUrl = process.env.RANKINGS_URL;

if (!username || !password || !discordToken) {
    throw new Error("Missing environment variables.");
}

let soldiers, tools;
connect();

const messages = [];
const attacksLogged = [];
const allianceLogsRead = [];
const phoneMessagesSent = [];
let alreadyLoggedFirstAllianceLogs = false;

const gameEvent = null; // 46: nomads | 51: samurais
const rankings = [];
const lastRanks = {};

const alliance = {};

getUnits()
    .then((units) => {
        soldiers = units.soldiers;
        tools = units.tools;
    })
    .catch((error) => {
        throw new Error(`Error while getting units: ${error}`);
    });

function connect() {
    const socket = server.socket;

    socket.addEventListener("open", (event) => {
        login(socket, username, password);
    });

    socket.addEventListener("message", async (event) => {
        const message = event.data.toString().split("%");

        const command = message[2];
        const code = message[4];
        let content = message[5];

        try {
            content = JSON.parse(content || "{}");
        } catch {}

        if (command === "lli") {
            if (code === "0") {
                console.log("Logged in");
                pingSocket();
            } else if (code === "21") {
                console.log("Reconnect");
                socket.send(
                    `%xt%${server.zone}%lre%1%{"DID":0,"CONM":515,"RTM":60,"campainPId":-1,"campainCr":-1,"campainLP":-1,"adID":-1,"timeZone":14,"username":"${username}","email":null,"password":"${password}","accountId":"1681390746855129824","ggsLanguageCode":"en","referrer":"https://empire.goodgamestudios.com","distributorId":0,"connectionTime":515,"roundTripTime":60,"campaignVars":";https://empire.goodgamestudios.com;;;;;;-1;-1;;1681390746855129824;0;;;;;","campaignVars_adid":"-1","campaignVars_lp":"-1","campaignVars_creative":"-1","campaignVars_partnerId":"-1","campaignVars_websiteId":"0","timezone":14,"PN":"${username}","PW":"${password}","REF":"https://empire.goodgamestudios.com","LANG":"fr","AID":"1681390746855129824","GCI":"","SID":9,"PLFID":1,"NID":1,"IC":""}%`
                );
            } else {
                console.log(`Error while logging in: ${code}`);
                socket.close();
            }
        } else if (command === "lre") {
            if (code === "0") {
                console.log("Reconnected");
                pingSocket();
            } else {
                console.log(`Error while reconnecting: ${code}`);
                server.reconnect = false;
                socket.close();
            }
        }

        if (command === "gbd") {
            if (!content["ain"]) return;
            const data = content["ain"]["A"];

            alliance.id = data["AID"];
            alliance.name = data["N"];
            alliance.mightPoints = data["MP"];
            alliance.members = data["M"].map((member) => ({
                id: member["OID"],
                username: member["N"],
                level: member["L"],
                legendaryLevel: member["LL"],
                mightPoints: member["MP"],
                honor: member["H"],
            }));

            if (gameEvent && rankingsUrl) {
                await getEventRanking(socket, gameEvent);
                rankings.sort((a, b) => b.score - a.score);

                // Add players that aren't in the rankings with a score of 0
                alliance.members.forEach((member) => {
                    if (!rankings.find((player) => player.id === member.id)) {
                        rankings.push({
                            id: member.id,
                            username: member.username,
                            score: 0,
                        });
                    }
                });

                const webhookData = {
                    content: `Event ${gameEvent} rankings:`,
                    embeds: [
                        {
                            title: "Rankings",
                            description: rankings
                                .map(
                                    (player, index) =>
                                        `${index + 1}. **${player.username}** - ${player.score}`
                                )
                                .join("\n"),
                            color: 14427686,
                        },
                    ],
                };

                try {
                    const res = await fetch(rankingsUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(webhookData),
                    });
                } catch (error) {
                    console.log(error);
                }
            }
        }

        if (command === "hgh") {
            const groupId = content["LID"];

            if (lastRanks[groupId]) {
                const players = content["L"];

                players.forEach((array) => {
                    const player = array[2];
                    const playerId = player["OID"];
                    const playerUsername = player["N"];

                    if (
                        allianceMembers.find((member) => member.id === playerId) &&
                        !rankings.find((player) => player.id === playerId)
                    ) {
                        const rank = array[0];
                        const score = array[1];

                        rankings.push({
                            id: playerId,
                            username: playerUsername,
                            rank,
                            score,
                        });
                    }
                });
            } else {
                lastRanks[groupId] = content["LR"];

                let i = 1;
                while (i < content["LR"]) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    socket.send(
                        `%xt%EmpireEx_3%hgh%1%{"LT":${gameEvent},"LID":${groupId},"SV":"${i}"}%`
                    );

                    i += 8;
                }
            }
        }

        // Private message
        if (command === "sne") {
            return;

            const messageId = content["MSG"][0][0];

            messages.push({
                id: messageId,
                title: content["MSG"][0][2],
            });

            // Send request to read message
            socket.send(`%xt%EmpireEx_3%rms%1%{"MID":${messageId}}%`);
        }

        // Read message
        if (command === "rms") {
            return;

            const message = sanitize(content["MTXT"]);
            const title = messages.find((message) => message.id === content["MID"]).title;
        }

        // Attack | Support
        if (command === "gam" && attacksUrl) {
            if (!content["O"]) return;

            const firstPlayer = content["O"][0];
            const secondPlayer = content["O"][1];

            if (!firstPlayer || !secondPlayer) return;
            if (firstPlayer["AID"] === secondPlayer["AID"]) return;

            const attackedId = content["M"][0]["M"]["TA"][4];
            const attackerId = content["M"][0]["M"]["SA"][4];

            const attacked = firstPlayer["OID"] === attackedId ? firstPlayer : secondPlayer;
            const attacker = firstPlayer["OID"] === attackerId ? firstPlayer : secondPlayer;

            if (attacker["AN"] === alliance.name || attacked["AN"] !== alliance.name) return;

            const ent = content["M"][0]["GS"];
            const numberOfTroops = {
                total: 0,
                left: 0,
                right: 0,
                middle: 0,
                courtyard: 0,
            };
            const numberOfTools = {
                total: 0,
                left: 0,
                right: 0,
                middle: 0,
                courtyard: 0,
            };

            if (!ent && content["M"][0]["GA"]) {
                const leftSide = content["M"][0]["GA"]["L"];
                const rightSide = content["M"][0]["GA"]["R"];
                const middleSide = content["M"][0]["GA"]["M"];
                const courtyard = content["M"][0]["GA"]["RW"];

                function getAmount(item, side) {
                    const id = item[0];
                    const number = item[1];

                    const isSoldier = soldiers.find((soldier) => soldier.id === id);
                    const isTool = tools.find((tool) => tool.id === id);

                    if (isSoldier) {
                        numberOfTroops.total += number;
                        numberOfTroops[side] += number;
                    } else if (isTool) {
                        numberOfTools.total += number;
                        numberOfTools[side] += number;
                    } else {
                        console.log(`Unknown unit ${id} on ${side} side with ${number} units.`);
                    }
                }

                leftSide.forEach((item) => getAmount(item, "left"));
                rightSide.forEach((item) => getAmount(item, "right"));
                middleSide.forEach((item) => getAmount(item, "middle"));
                courtyard.forEach((item) => getAmount(item, "courtyard"));
            }

            if (!ent && !numberOfTroops.total) {
                return;
            }

            const travelTime = content["M"][0]["M"]["TT"]; // in seconds
            const timeTravelled = content["M"][0]["M"]["PT"]; // in seconds

            const timeToLand = travelTime - timeTravelled;
            const timeRemaining = getTimeString(timeToLand);

            const date = new Date();
            date.setSeconds(date.getSeconds() + timeToLand);

            const arrivalDateRelative = `<t:${Math.floor(date.getTime() / 1000)}:R>`;

            const firstPosition = content["M"][0]["M"]["KID"];
            const secondPosition = content["M"][0]["M"]["TA"][0];
            const positions = {
                "01": "Château Principal",
                "04": "Avant-poste",
                212: "Glaces",
                112: "Sables",
                312: "Pics",
                412: "CP Iles",
                424: "Ile a ressources",
            };

            // Storm Islands, don't care
            if (firstPosition === 4) {
                return;
            }

            const position = positions[`${firstPosition}${secondPosition}`];
            const positionName = content["M"][0]["M"]["TA"][firstPosition === 4 ? 6 : 10];
            const attackerPositionName = content["M"][0]["M"]["SA"][firstPosition === 4 ? 6 : 10];

            const nomCommandant = content["M"][0]["UM"]["L"]["N"];

            const isCastellan = !!content["M"][0]["UM"]["L"]["LICID"];
            const isCapture = isCastellan && !nomCommandant;

            const eventTitle = `${attacked["N"]} se fait attaquer pour un evenement par ${attacker["N"]}`;
            const captureTitle = `${attacked["N"]} se fait capturer un ${position} par ${attacker["N"]}`;
            const attackTitle = `${attacked["N"]} se fait attaquer par ${attacker["N"]}`;

            const notKnownDescription = `
                Nombre de troupes estimé: ${ent}

                Alliance: ${attacker["AN"] || "Sans Alliance"}
                Nom du commandant: ${nomCommandant || (isCapture ? "Bailli" : "Sans nom")}

                Position: ${position}
                Nom position: ${positionName}

                Temps restant: ${timeRemaining}
                Date d'arrivée: ${arrivalDateRelative}
            `;

            const knownDescription = `
                Alliance: ${attacker["AN"] || "Sans Alliance"}
                Nom du commandant: ${nomCommandant || (isCapture ? "Bailli" : "Sans nom")}

                Position: ${position}
                Nom position: ${positionName}

                Nombre total de troupes: ${numberOfTroops.total}
                Nombre total d'engins: ${numberOfTools.total}

                Troupes flanc gauche: ${numberOfTroops.left}
                Engins flanc gauche: ${numberOfTools.left}

                Troupes flanc droit: ${numberOfTroops.right}
                Engins flanc droit: ${numberOfTools.right}

                Troupes front: ${numberOfTroops.middle}
                Engins front: ${numberOfTools.middle}

                Troupes cour: ${numberOfTroops.courtyard}
                Engins cour: ${numberOfTools.courtyard}

                Temps restant: ${timeRemaining}
                Date d'arrivée: ${arrivalDateRelative}
            `;

            const embed = {
                title: !attackerPositionName ? eventTitle : isCapture ? captureTitle : attackTitle,
                description: ent ? notKnownDescription : knownDescription,
                color: 14427686,
            };

            let message = "";

            // If can find player, send a ping
            const player = players.find((player) => player.username === attacked["N"]);
            if (player && attackerPositionName) {
                if (!player.minTroops || numberOfTroops >= player.minTroops) {
                    player.discordIds.forEach((discordId) => {
                        message += `<@${discordId}> `;
                    });
                }

                const hasMessageBeenSent = phoneMessagesSent.find(
                    (message) => message.attackId === content["M"][0]["M"]["MID"]
                );

                if (player.telephone && !hasMessageBeenSent) {
                    try {
                        const { number, minTroops, sms, call } = player.telephone;

                        if (numberOfTroops.total >= minTroops || ent >= minTroops) {
                            if (sms) {
                                sendSms(
                                    `
                                    Vous êtes attaqués sur GGE par ${attacker["N"]}
                                    de l'alliance ${attacker["AN"]} !
                                    L'attaque arrivera dans ${timeRemaining} avec
                                    ${ent ? "environ " + ent : numberOfTroops.total} soldats
                                    `,
                                    number
                                );
                            }

                            if (call) {
                                sendCall(
                                    `
                                    Vous êtes attaqués sur G G E par ${attacker["N"]} !
                                    L'attaque arrivera dans ${timeRemaining} avec
                                    ${ent ? "environ " + ent : numberOfTroops.total} soldats
                                    `,
                                    number
                                );
                            }

                            if (call || sms) {
                                phoneMessagesSent.push({
                                    attackId: content["M"][0]["M"]["MID"],
                                });
                            }
                        }
                    } catch (error) {
                        console.log(error);
                    }
                }
            }

            const webhookData = {
                content: message.length > 0 ? message : undefined,
                embeds: [embed],
            };

            try {
                const attackId = content["M"][0]["M"]["MID"];
                const alreadyLogged = attacksLogged.find((attack) => attack.id === attackId);

                // If already logged, update the message
                // If not, create a new message
                if (alreadyLogged) {
                    const res = await fetch(`${attacksUrl}/messages/${alreadyLogged.messageId}`, {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(webhookData),
                    });
                } else {
                    const res = await fetch(`${attacksUrl}?wait=true`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(webhookData),
                    });

                    const message = await res.text();

                    attacksLogged.push({
                        id: attackId,
                        messageId: JSON.parse(message)["id"],
                        attacker: attacker["N"],
                        attacked: attacked["N"],
                        ent,
                        numberOfTroops,
                        date,
                    });
                }
            } catch (error) {
                console.log(error);
            }
        }

        // Attack removed
        if (command === "mrm" && attacksUrl) {
            const attackId = content["MID"];
            const attack = attacksLogged.find((attack) => attack.id === attackId);
            if (!attack) return;

            const embed = {
                title: `${attack.attacker} a retiré son attaque sur ${attack.attacked}`,
                description: `
                    L'attaque qui devait arriver <t:${Math.floor(
                        attack.date.getTime() / 1000
                    )}:R> a été retirée.
                    Elle comportait ${
                        attack.ent ? "environ " + attack.ent : attack.numberOfTroops.total
                    } soldats.
                `,
                color: 2278750,
            };

            const webhookData = {
                embeds: [embed],
            };

            try {
                const res = await fetch(`${attacksUrl}/messages/${attack.messageId}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(webhookData),
                });
            } catch (error) {
                console.log(error);
            }
        }

        // Alliance chat message
        if (command === "acm" && chatUrl) {
            const sender = content["CM"]["PN"];
            const message = sanitize(content["CM"]["MT"]);

            if (sender === "Vroom") return;

            // Date must be the current date in France
            const date = new Intl.DateTimeFormat("fr-FR", {
                timeZone: "Europe/Paris",
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
            }).format(new Date());

            const webhookData = {
                content: `[${date}] ${sender}: ${message}`,
            };

            try {
                const res = await fetch(chatUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(webhookData),
                });
            } catch (error) {
                console.log(error);
            }
        }

        // Alliance logs
        if (command === "all") {
            return;

            // 0 - Joined alliance
            // 1 - Left alliance
            // 2 - Kicked from alliance
            const logs = content["AL"].filter(
                (log) => log["A"] === 0 || log["A"] === 1 || log["A"] === 2
            );

            logs.forEach((log) => {
                if (allianceLogsRead.includes(log["MA"])) return;
                allianceLogsRead.push(log["MA"]);

                if (log["A"] === 0) {
                    console.log(`${log["PN"]} joined the alliance.`);
                } else if (log["A"] === 1) {
                    console.log(`${log["PN"]} left the alliance.`);
                } else {
                    console.log(`${log["AV"][1]} was kicked from the alliance by ${log["PN"]}.`);
                }
            });
        }
    });

    socket.addEventListener("error", (event) => {
        if (["ENOTFOUND", "ETIMEDOUT"].includes(event.error.code)) {
            server.reconnect = false;
        }

        console.log(`Socket error: ${event.error.code}`);
        socket.close();
    });

    socket.addEventListener("close", (event) => {
        if (server.reconnect) {
            setTimeout(() => connect(), 10000);
        } else {
            console.log(`Socket closed permanently.`);

            socket.removeAllListeners();
            process.exit(1);
        }
    });
}

function pingSocket() {
    if (![WebSocket.CLOSED, WebSocket.CLOSING].includes(server.socket.readyState)) {
        console.log(`Pinging socket...`);
        server.socket.send(`%xt%${server.zone}%pin%1%<RoundHouseKick>%`);
        setTimeout(() => pingSocket(), 60000);
    } else {
        console.log(`Socket is closed, can't ping.`);
    }
}

const clientOptions = {
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates,
    ],
    presence: {
        status: "online",
        activities: [
            {
                name: "Goodgame Empire",
                type: ActivityType.Playing,
            },
        ],
    },
    partials: [Partials.Channel],
};

export const client = new Client(clientOptions);

// Events
const eventsPath = join(process.cwd(), "events");
const eventFiles = readdirSync(eventsPath).filter(
    (file) => file.endsWith(".js") || file.endsWith(".ts")
);

for (const file of eventFiles) {
    const url = `file:///${join(eventsPath, file)}`;
    const eventFile = await import(url);

    if (eventFile.once) {
        client.once(eventFile.name, (...args) => eventFile.execute(...args));
    } else if (eventFile.once === false) {
        client.on(eventFile.name, (...args) => eventFile.execute(...args));
    }
}

// Commands
client.commands = new Collection();
client.cooldowns = new Collection();

const foldersPath = join(process.cwd(), "commands");
const commandFolders = readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = join(foldersPath, folder);
    const commandFiles = readdirSync(commandsPath).filter(
        (file) => file.endsWith(".js") || file.endsWith(".ts")
    );

    for (const file of commandFiles) {
        const url = `file:///${join(commandsPath, file)}`;
        const commandFile = await import(url);

        if (commandFile.data && commandFile.execute) {
            client.commands.set(commandFile.data.name, commandFile);
        } else {
            console.log(
                `[WARNING] The command at ${url} is missing a required "data" or "execute" property.`
            );
        }
    }
}

if (useDiscordBot) {
    client.login(discordToken);
}
