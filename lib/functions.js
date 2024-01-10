import { server } from "./server.js";

export function login(socket, username, password, server = "EmpireEx_3") {
    socket.send(
        `<msg t='sys'><body action='login' r='0'><login z='${server}'><nick><![CDATA[]]></nick><pword><![CDATA[1094003%fr%0]]></pword></login></body></msg>`
    );
    socket.send(
        `%xt%${server}%lli%1%{"CONM":175,"RTM":24,"ID":0,"PL":1,"NOM":"${username}","PW":"${password}","LT":null,"LANG":"fr","DID":"0","AID":"1674256959939529708","KID":"","REF":"https://empire.goodgamestudios.com","GCI":"","SID":9,"PLFID":1}%`
    );
}

export function sendMessageToChat(username, message) {
    server.socket.send(`%xt%${server.zone}%acm%1%{"M":"${username}: ${message}"}%`);
}

export async function getEventRanking(socket, event) {
    socket.send(`%xt%EmpireEx_3%hgh%1%{"LT":${event},"LID":${1},"SV":"1"}%`);
    await new Promise((resolve) => setTimeout(resolve, 20000));

    socket.send(`%xt%EmpireEx_3%hgh%1%{"LT":${event},"LID":${2},"SV":"1"}%`);
    await new Promise((resolve) => setTimeout(resolve, 20000));

    socket.send(`%xt%EmpireEx_3%hgh%1%{"LT":${event},"LID":${3},"SV":"1"}%`);
    await new Promise((resolve) => setTimeout(resolve, 20000));

    socket.send(`%xt%EmpireEx_3%hgh%1%{"LT":${event},"LID":${4},"SV":"1"}%`);
    await new Promise((resolve) => setTimeout(resolve, 20000));

    socket.send(`%xt%EmpireEx_3%hgh%1%{"LT":${event},"LID":${5},"SV":"1"}%`);
    await new Promise((resolve) => setTimeout(resolve, 50000));
}
