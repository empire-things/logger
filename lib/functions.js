import { server } from "./server.js";

export function login(socket, u, p, a) {
    socket.send(`<msg t='sys'><body action='verChk' r='0'><ver v='166' /></body></msg>`);
    socket.send(
        `<msg t='sys'><body action='login' r='0'><login z='EmpireEx_3'><nick><![CDATA[]]></nick><pword><![CDATA[1094003%en%0]]></pword></login></body></msg>`
    );
    socket.send(`<msg t='sys'><body action='autoJoin' r='-1'></body></msg>`);
    socket.send(`<msg t='sys'><body action='roundTrip' r='1'></body></msg>`);
    socket.send(`%xt%EmpireEx_3%vck%1%1094003%web-html5%<RoundHouseKick>%6.721722297737097e+307%`);
    socket.send(`%xt%EmpireEx_3%vln%1%{"NOM":"${u}"}%`);
    socket.send(
        `%xt%EmpireEx_3%lli%1%{"CONM":157,"RTM":25,"ID":0,"PL":1,"NOM":"${u}","PW":"${p}","LT":null,"LANG":"en","DID":"0","AID":"${a}","KID":"","REF":"https://empire.goodgamestudios.com","GCI":"","SID":9,"PLFID":1}%`
    );
}

export function displayMessage(title, content) {
    console.log(`[${title}] ${content}`);
}

export function sendMessageToChat(username, message) {
    server.socket.send(`%xt%EmpireEx_3%acm%1%{"M":"(Discord) ${username}: ${message}"}%`);
}
