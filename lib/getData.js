export async function getUnits() {
    const vUrl = "https://empire-html5.goodgamestudios.com/default/items/ItemsVersion.properties";
    const version = (await fetch(vUrl).then((res) => res.text())).split("=")[1].trim();

    const itemsUrl = `https://empire-html5.goodgamestudios.com/default/items/items_v${version}.json`;
    const units = (await fetch(itemsUrl).then((res) => res.json())).units;

    const tools = units
        .filter((unit) => !!unit.typ)
        .map((tool) => ({
            id: tool.wodID,
            name: tool.comment2,
            level: tool.level,
        }));

    const soldiers = units
        .filter((unit) => !unit.typ)
        .map((soldier) => ({
            id: soldier.wodID,
            name: soldier.comment2,
            level: soldier.level,
        }));

    return { tools, soldiers };
}
