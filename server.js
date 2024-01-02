const { getTimeString } = require("./lib/time");
const { XMLParser } = require("fast-xml-parser");
const { sanitize } = require("./lib/string");
const WebSocket = require("ws");
require("dotenv").config();
const fs = require("fs");

const players = require("./data/players.js");
const soldiers = require("./data/soldiers.js");
const tools = require("./data/tools.js");
const { login, displayMessage } = require("./lib/functions.js");

const username = process.env.USERNAMEE;
const password = process.env.PASSWORD;
const accountId = process.env.ACCOUNT_ID;
const allianceId = process.env.ALLIANCE_ID;

if (!username || !password || !accountId || !allianceId) {
    throw new Error("Missing environment variables.");
}

const servers = {};
getServers();

const webhookUrlAttacks = process.env.WEBHOOK_URL_ATTACKS;
const webhookUrlAllianceChat = process.env.WEBHOOK_URL_ALLIANCE_CHAT;
const webhookUrlAllianceLogs = process.env.WEBHOOK_URL_ALLIANCE_LOGS;
const allianceLogsRead = [];
let alreadyLoggedFirstAllianceLogs = false;

const messages = [];

// getUnits();

async function getUnits() {
    const versionUrl =
        "https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties";
    const versionFile = await fetch(versionUrl).then((res) => res.text());

    const version = versionFile.split("=")[1].trim();

    const itemsUrl = `https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`;
    const itemsFile = await fetch(itemsUrl).then((res) => res.json());
    const units = itemsFile.units;

    const tools = units.filter((unit) => !!unit.typ);
    const soldiers = units.filter((unit) => !unit.typ);

    const soldiersFile = fs.createWriteStream("./data/soldiers.js");
    // Create array named soldiers with all soldiers and export it
    soldiersFile.write(`const soldiers = [\n`);
    soldiers.forEach((soldier) => {
        if (soldier.level) {
            soldiersFile.write(
                `    { id: ${soldier.wodID}, name: "${soldier.comment2}", level: "${soldier.level}" },\n`
            );
        } else {
            soldiersFile.write(`    { id: ${soldier.wodID}, name: "${soldier.comment2}" },\n`);
        }
    });

    soldiersFile.write(`];\n\nmodule.exports = soldiers;`);
    soldiersFile.end();

    const toolsFile = fs.createWriteStream("./data/tools.js");
    // Create array named tools with all tools and export it
    toolsFile.write(`const tools = [\n`);
    tools.forEach((tool) => {
        if (tool.level) {
            toolsFile.write(
                `    { id: ${tool.wodID}, name: "${tool.comment2}", level: "${tool.level}" },\n`
            );
        } else {
            toolsFile.write(`    { id: ${tool.wodID}, name: "${tool.comment2}" },\n`);
        }
    });

    toolsFile.write(`];\n\nmodule.exports = tools;`);
    toolsFile.end();
}

async function getServers() {
    const serversUrl = "https://empire-html5.goodgamestudios.com/config/network/1.xml";
    const serversFile = new XMLParser().parse(await fetch(serversUrl).then((res) => res.text()));

    for (instance of serversFile.network.instances.instance) {
        if (instance.zone === "EmpireEx_3") {
            servers[instance.zone] = {
                url: `wss://${instance.server}`,
                socket: new WebSocket(`wss://${instance.server}`),
                reconnect: true,
                message: {},
                response: "",
            };

            connect(instance.zone);
        }
    }
}

function connect(header) {
    const socket = servers[header].socket;

    socket.addEventListener("open", async (event) => {
        login(socket, username, password, allianceId);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check alliance logs every minute
        socket.send(`%xt%EmpireEx_3%all%1%{}%`);
        setInterval(() => socket.send(`%xt%EmpireEx_3%all%1%{}%`), 60000);
    });

    socket.addEventListener("message", async (event) => {
        const message = event.data.toString().split("%");

        const data = {
            server: header,
            command: message[2],
            code: message[4],
            content: JSON.parse(JSON.stringify(message[5] || "{}")),
        };

        if (data.command === "lli") {
            if (data.code === "0") {
                pingSocket(socket, header);
            } else if (data.code === "21") {
                socket.send(
                    `%xt%${header}%lre%1%{"DID":0,"CONM":515,"RTM":60,"campainPId":-1,"campainCr":-1,"campainLP":-1,"adID":-1,"timeZone":14,"username":"${username}","email":null,"password":"${password}","accountId":"${accountId}","ggsLanguageCode":"en","referrer":"https://empire.goodgamestudios.com","distributorId":0,"connectionTime":515,"roundTripTime":60,"campaignVars":";https://empire.goodgamestudios.com;;;;;;-1;-1;;1681390746855129824;0;;;;;","campaignVars_adid":"-1","campaignVars_lp":"-1","campaignVars_creative":"-1","campaignVars_partnerId":"-1","campaignVars_websiteId":"0","timezone":14,"PN":"${username}","PW":"${password}","REF":"https://empire.goodgamestudios.com","LANG":"fr","AID":"${allianceId}","GCI":"","SID":9,"PLFID":1,"NID":1,"IC":""}%`
                );
            } else {
                socket.close();
            }
        } else if (data.command === "lre") {
            if (data.code === "0") {
                pingSocket(socket, header);
            } else {
                servers[header].reconnect = false;
                socket.close();
            }
        }

        if (data.command === "sne") {
            return;
            // Private message
            const content = JSON.parse(data.content);
            const messageId = content["MSG"][0][0];

            messages.push({
                id: messageId,
                title: content["MSG"][0][2],
            });

            // Send request to read message
            socket.send(`%xt%EmpireEx_3%rms%1%{"MID":${messageId}}%`);
        }

        if (data.command === "rms") {
            return;
            // Read message
            const content = JSON.parse(data.content);
            const message = sanitize(content["MTXT"]);
            const title = messages.find((message) => message.id === content["MID"]).title;

            // Could also get the sender's name
            // Would also be great to get special messages like war announcements

            displayMessage(title, message);
        }

        if (data.command === "gam") {
            // Attack / Support
            const content = JSON.parse(data.content);
            const currentAllianceName = "THE INSANES"; // TODO: get alliance name programmatically

            const firstPlayer = content["O"][0];
            const secondPlayer = content["O"][1];

            if (!firstPlayer || !secondPlayer) return;

            // If both players' alliance is the same, then we don't care loging the attack
            if (firstPlayer["AID"] === secondPlayer["AID"]) return;

            const idOfAttackedPlayer = content["M"][0]["M"]["TA"][4];
            const idOfAttackingPlayer = content["M"][0]["M"]["SA"][4];

            const attackedPlayer =
                firstPlayer["OID"] === idOfAttackedPlayer ? firstPlayer : secondPlayer;
            const attackingPlayer =
                firstPlayer["OID"] === idOfAttackingPlayer ? firstPlayer : secondPlayer;

            const attackedUsername = attackedPlayer["N"];
            const attackedAlliance = attackedPlayer["AN"];

            const attackingUsername = attackingPlayer["N"];
            const attackingAlliance = attackingPlayer["AN"];

            if (
                attackingAlliance === currentAllianceName ||
                attackedAlliance !== currentAllianceName
            )
                return;

            // If estimation isn't available, this means we don't know much about the attack yet
            // Need to store the data and update it when we get the real data

            const estimatedNumberOfTroops = content["M"][0]["GS"];
            let numberOfTroops = {
                total: 0,
                left: 0,
                right: 0,
                middle: 0,
                courtyard: 0,
            };
            let numberOfTools = {
                total: 0,
                left: 0,
                right: 0,
                middle: 0,
                courtyard: 0,
            };

            if (!estimatedNumberOfTroops && content["M"][0]["GA"]) {
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
                        console.log(`Unknown soldier/tool: ${id}. With number: ${number}`);
                    }
                }

                leftSide.forEach((item) => getAmount(item, "left"));
                rightSide.forEach((item) => getAmount(item, "right"));
                middleSide.forEach((item) => getAmount(item, "middle"));
                courtyard.forEach((item) => getAmount(item, "courtyard"));
            }

            const travelTime = content["M"][0]["M"]["TT"]; // in seconds
            const timeTravelled = content["M"][0]["M"]["PT"]; // in seconds

            // To know when it's gonna land, substract the time travelled to the travel time
            const timeToLand = travelTime - timeTravelled;
            const timeRemaining = getTimeString(timeToLand);

            const date = new Date();
            date.setSeconds(date.getSeconds() + timeToLand);

            const arrivalDateRelative = `<t:${Math.floor(date.getTime() / 1000)}:R>`;

            const notKnownDescription = `
                Nombre de troupes estimé: ${estimatedNumberOfTroops}

                Alliance: ${attackingAlliance || "Sans Alliance"}
                
                Temps restant: ${timeRemaining}
                Date d'arrivée: ${arrivalDateRelative}
            `;

            const knownDescription = `
                Alliance: ${attackingAlliance || "Sans Alliance"}

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
                title: `${attackedUsername} se fait attaquer par ${attackingUsername}`,
                description: estimatedNumberOfTroops ? notKnownDescription : knownDescription,
                color: 14427686,
            };

            let message = "";

            // if can find player, send a ping
            const player = players.find((player) => player.username === attackedUsername);
            if (player && (!player.minTroops || numberOfTroops >= player.minTroops)) {
                message = `<@${player.discordId}>`;
            }

            const webhookData = {
                content: message.length > 0 ? message : undefined,
                embeds: [embed],
            };

            try {
                const res = await fetch(webhookUrlAttacks, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(webhookData),
                });

                if (res.status !== 204) {
                    console.log("Error while sending message to Discord.");
                }
            } catch (error) {
                console.log(error);
            }
        }

        if (data.command === "acm") {
            // Alliance chat message
            return;

            const content = JSON.parse(data.content);

            const sender = content["CM"]["PN"];
            const message = sanitize(content["CM"]["MT"]);

            const webhookData = {
                content: `**${sender}**: ${message}`,
            };

            const threadId = "1191570871995879474";

            try {
                // Use string params for threadId
                const res = await fetch(`${webhookUrlAllianceChat}?thread_id=${threadId}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(webhookData),
                });

                if (res.status !== 204) {
                    console.log("Error while sending message to Discord.");
                    console.log(await res.text());
                }
            } catch (error) {
                console.log(error);
            }
        }

        if (data.command === "all") {
            // Alliance logs
            return;

            const content = JSON.parse(data.content);

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
            servers[header].reconnect = false;
        }

        socket.close();
    });

    socket.addEventListener("close", (event) => {
        if (servers[header].reconnect) {
            setTimeout(() => connect(header), 10000);
        } else {
            console.log(`Socket ${header} closed permanently.`);
            delete servers[header];
        }
    });
}

function pingSocket(socket, header) {
    if (socket.readyState != WebSocket.CLOSED && socket.readyState != WebSocket.CLOSING) {
        console.log(`Pinging socket ${header}`);
        socket.send(`%xt%${header}%pin%1%<RoundHouseKick>%`);
        setTimeout(() => pingSocket(socket, header), 60000);
    }
}
