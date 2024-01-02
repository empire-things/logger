function login(socket, u, p, a) {
    socket.send(`<msg t='sys'><body action='verChk' r='0'><ver v='166' /></body></msg>`);
    socket.send(
        `<msg t='sys'><body action='login' r='0'><login z='EmpireEx_3'><nick><![CDATA[]]></nick><pword><![CDATA[1093006%en%0]]></pword></login></body></msg>`
    );
    socket.send(`<msg t='sys'><body action='autoJoin' r='-1'></body></msg>`);
    socket.send(`<msg t='sys'><body action='roundTrip' r='1'></body></msg>`);
    socket.send(`%xt%EmpireEx_3%vck%1%1093006%web-html5%<RoundHouseKick>%1.6082669484889843e+308%`);
    socket.send(`%xt%EmpireEx_3%vln%1%{"NOM":"${u}"}%`);
    socket.send(
        `%xt%EmpireEx_3%lli%1%{"CONM":112,"RTM":20,"ID":0,"PL":1,"NOM":"${u}","PW":"${p}","LT":null,"LANG":"en","DID":"0","AID":"${a}","KID":"","REF":"https://empire.goodgamestudios.com","GCI":"","SID":9,"PLFID":1}%`
    );
}

function displayMessage(title, content) {
    console.log(`[${title}] ${content}`);
}

module.exports = {
    login,
    displayMessage,
};
