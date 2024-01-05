import WebSocket from "ws";

export const server = {
    zone: "EmpireEx_3",
    url: `wss://ep-live-fr1-game.goodgamestudios.com`,
    socket: new WebSocket(`wss://ep-live-fr1-game.goodgamestudios.com`),
    reconnect: true,
    message: {},
    response: "",
};
