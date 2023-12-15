const express = require("express");
const WebSocket = require("ws");
const { XMLParser } = require("fast-xml-parser");
require("dotenv").config();

const servers = {};
getServers();
setTimeout(getServers, 3600000);

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
            `<msg t='sys'><body action='login' r='0'><login z='EmpireEx_3'><nick><![CDATA[]]></nick><pword><![CDATA[1091009%en%0]]></pword></login></body></msg>`
        );

        socket.send(`<msg t='sys'><body action='autoJoin' r='-1'></body></msg>`);
        socket.send(`<msg t='sys'><body action='roundTrip' r='1'></body></msg>`);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        socket.send(
            `%xt%EmpireEx_3%vck%1%1091009%web-html5%<RoundHouseKick>%9.627276213442853e+307%`
        );

        socket.send(
            `%xt%EmpireEx_3%lli%1%{"CONM":112,"RTM":20,"ID":0,"PL":1,"NOM":"Qwaark","PW":"7qzLZTX9MK9MuKp9","LT":null,"LANG":"en","DID":"0","AID":"1701342315180714068","KID":"","REF":"https://empire.goodgamestudios.com","GCI":"","SID":9,"PLFID":1}%`
        );

        await new Promise((resolve) => setTimeout(resolve, 5000));

        socket.send(`%xt%EmpireEx_3%gbl%1%{}%`);
        socket.send(`%xt%EmpireEx_3%upt%1%{}%`);

        await new Promise((resolve) => setTimeout(resolve, 5000));

        socket.send(`%xt%EmpireEx_3%aci%1%{"TX":182,"TY":1001,"SX":182,"SY":1005,"KID":0}%`);
        socket.send(`%xt%EmpireEx_3%gas%1%{}%`);

        await new Promise((resolve) => setTimeout(resolve, 5000));

        socket.send(
            `%xt%EmpireEx_3%cra%1%{"SX":182,"SY":1005,"TX":182,"TY":1001,"KID":0,"LID":0,"WT":0,"HBW":-1,"BPC":0,"ATT":0,"AV":1,"LP":0,"FC":0,"PTT":1,"SD":0,"ICA":0,"CD":99,"A":[{"L":{"T":[[-1,0],[-1,0]],"U":[[216,85],[-1,0]]},"R":{"T":[[-1,0],[-1,0]],"U":[[216,122],[-1,0]]},"M":{"T":[[-1,0],[-1,0],[-1,0]],"U":[[216,267],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0]]}}],"BKS":[],"AST":[-1,-1,-1],"RW":[[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0],[-1,0]],"ASCT":0}%`
        );
    });

    socket.addEventListener("message", (event) => {
        const eventData = event.data.toString().split("%");
        console.log("Event Data ", eventData);

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
                    `%xt%${header}%lre%1%{"DID":0,"CONM":515,"RTM":60,"campainPId":-1,"campainCr":-1,"campainLP":-1,"adID":-1,"timeZone":14,"username":"${username}","email":null,"password":"${password}","accountId":"${accountId}","ggsLanguageCode":"en","referrer":"https://empire.goodgamestudios.com","distributorId":0,"connectionTime":515,"roundTripTime":60,"campaignVars":";https://empire.goodgamestudios.com;;;;;;-1;-1;;1681390746855129824;0;;;;;","campaignVars_adid":"-1","campaignVars_lp":"-1","campaignVars_creative":"-1","campaignVars_partnerId":"-1","campaignVars_websiteId":"0","timezone":14,"PN":"${username}","PW":"${password}","REF":"https://empire.goodgamestudios.com","LANG":"fr","AID":"1681390746855129824","GCI":"","SID":9,"PLFID":1,"NID":1,"IC":""}%`
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
