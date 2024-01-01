const { getTimeString } = require("./lib/time");
const { XMLParser } = require("fast-xml-parser");
const { sanitize } = require("./lib/string");
const WebSocket = require("ws");
require("dotenv").config();

const players = require("./data/players.js");
const soldiers = require("./data/soldiers.js");
const tools = require("./data/tools.js");

const username = process.env.USERNAMEE;
const password = process.env.PASSWORD;
const accountId = process.env.ACCOUNT_ID;
const allianceId = process.env.ALLIANCE_ID;

if (!username || !password || !accountId || !allianceId) {
    throw new Error("Missing environment variables.");
}

const servers = {};
getServers();
setTimeout(getServers, 3600000);

const allianceLogsRead = [];
let alreadyLoggedFirstAllianceLogs = false;

const messages = [];

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
        socket.send(`<msg t='sys'><body action='verChk' r='0'><ver v='166' /></body></msg>`);

        socket.send(
            `<msg t='sys'><body action='login' r='0'><login z='EmpireEx_3'><nick><![CDATA[]]></nick><pword><![CDATA[1093006%en%0]]></pword></login></body></msg>`
        );

        socket.send(`<msg t='sys'><body action='autoJoin' r='-1'></body></msg>`);
        socket.send(`<msg t='sys'><body action='roundTrip' r='1'></body></msg>`);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        socket.send(
            `%xt%EmpireEx_3%vck%1%1093006%web-html5%<RoundHouseKick>%1.6082669484889843e+308%`
        );

        socket.send(`%xt%EmpireEx_3%vln%1%{"NOM":"${username}"}%`);

        socket.send(
            `%xt%EmpireEx_3%lli%1%{"CONM":112,"RTM":20,"ID":0,"PL":1,"NOM":"${username}","PW":"${password}","LT":null,"LANG":"en","DID":"0","AID":"${allianceId}","KID":"","REF":"https://empire.goodgamestudios.com","GCI":"","SID":9,"PLFID":1}%`
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check alliance logs every minute

        socket.send(`%xt%EmpireEx_3%all%1%{}%`);

        setTimeout(() => {
            socket.send(`%xt%EmpireEx_3%all%1%{}%`);
        }, 60000);
    });

    socket.addEventListener("message", async (event) => {
        const eventData = event.data.toString().split("%");

        const response = {
            server: header,
            command: eventData[2],
            code: eventData[4],
            content: JSON.parse(JSON.stringify(eventData[5] || "")),
        };

        if (response.command === "lli") {
            if (response.code === "0") {
                pingSocket(socket, header);
            } else if (response.code === "21") {
                socket.send(
                    `%xt%${header}%lre%1%{"DID":0,"CONM":515,"RTM":60,"campainPId":-1,"campainCr":-1,"campainLP":-1,"adID":-1,"timeZone":14,"username":"${username}","email":null,"password":"${password}","accountId":"${accountId}","ggsLanguageCode":"en","referrer":"https://empire.goodgamestudios.com","distributorId":0,"connectionTime":515,"roundTripTime":60,"campaignVars":";https://empire.goodgamestudios.com;;;;;;-1;-1;;1681390746855129824;0;;;;;","campaignVars_adid":"-1","campaignVars_lp":"-1","campaignVars_creative":"-1","campaignVars_partnerId":"-1","campaignVars_websiteId":"0","timezone":14,"PN":"${username}","PW":"${password}","REF":"https://empire.goodgamestudios.com","LANG":"fr","AID":"${allianceId}","GCI":"","SID":9,"PLFID":1,"NID":1,"IC":""}%`
                );
            } else {
                socket.close();
            }
        } else if (response.command === "lre") {
            if (response.code === "0") {
                pingSocket(socket, header);
            } else {
                servers[header].reconnect = false;
                socket.close();
            }
        }

        if (response.command === "sne") {
            // Private message
            const content = JSON.parse(response.content);
            const messageId = content["MSG"][0][0];

            messages.push({
                id: messageId,
                title: content["MSG"][0][2],
            });

            socket.send(`%xt%EmpireEx_3%rms%1%{"MID":${messageId}}%`);
        }

        if (response.command === "rms") {
            // Read message
            const content = JSON.parse(response.content);
            const message = sanitize(content["MTXT"]);
            const title = messages.find((message) => message.id === content["MID"]).title;

            console.log(`Message: ${title}\n${message}`);
        }

        if (response.command === "gam") {
            const currentAllianceId = 163094;
            const currentAllianceName = "THE INSANES";

            const content = JSON.parse(response.content);

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

            const estimatedNumberOfTroops = content["M"][0]["GS"];
            let numberOfTroops = null;
            let numberOfTools = null;

            if (!estimatedNumberOfTroops && content["M"][0]["GA"]) {
                const leftSide = content["M"][0]["GA"]["L"];
                const rightSide = content["M"][0]["GA"]["R"];
                const middleSide = content["M"][0]["GA"]["M"];
                const courtyard = content["M"][0]["GA"]["RW"];

                function getAmount(item) {
                    const id = item[0];
                    const number = item[1];

                    if (soldiers[id]) {
                        numberOfTroops += number;
                    } else if (tools[id]) {
                        numberOfTools += number;
                    } else {
                        console.log(`Unknown soldier/tool: ${id}. With number: ${number}`);
                    }
                }

                leftSide.forEach((item) => getAmount(item));
                rightSide.forEach((item) => getAmount(item));
                middleSide.forEach((item) => getAmount(item));
                courtyard.forEach((item) => getAmount(item));
            }

            const travelTime = content["M"][0]["M"]["TT"]; // in seconds
            const timeTravelled = content["M"][0]["M"]["PT"]; // in seconds

            // To know when it's gonna land, substract the time travelled to the travel time
            const timeToLand = travelTime - timeTravelled;
            const timeRemaining = getTimeString(timeToLand);

            const date = new Date();
            date.setSeconds(date.getSeconds() + timeToLand);

            const webhookUrl = process.env.WEBHOOK_URL;

            const embed = {
                title: `${attackedUsername} se fait attaquer par ${attackingUsername}`,
                description: estimatedNumberOfTroops
                    ? `Nombre de troupes estimé: ${estimatedNumberOfTroops}\nAlliance: ${attackingAlliance}\n\nTemps restant: ${timeRemaining}\nDate d'arrivée: ${date.toLocaleString(
                          "fr-FR"
                      )}`
                    : `Nombre de troupes: ${
                          numberOfTroops || "NA"
                      }\nNombre d'outils: ${"NA"}\nAlliance: ${attackingAlliance}\n\nTemps restant: ${timeRemaining}\nDate d'arrivée: ${date.toLocaleString(
                          "fr-FR"
                      )}`,
                color: 14427686,
            };

            let message = "";

            // if can find player, send a ping
            const player = players.find((player) => player.username === attackedUsername);
            if (player) {
                message = `<@${player.discordId}>`;
            }

            const webhookData = {
                content: message.length > 0 ? message : undefined,
                embeds: [embed],
            };

            try {
                const res = await fetch(webhookUrl, {
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

        if (response.command === "acm") {
            // Alliance chat message
            const content = JSON.parse(response.content);

            const sender = content["CM"]["PN"];
            const message = sanitize(content["CM"]["MT"]);

            const webhookUrl = process.env.WEBHOOK_URL;

            const webhookData = {
                content: `**${sender}**: ${message}`,
            };

            try {
                const res = await fetch(webhookUrl, {
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

        if (response.command === "all") {
            const content = JSON.parse(response.content);
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
