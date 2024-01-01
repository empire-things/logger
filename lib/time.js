function getTimeString(seconds) {
    // Returns a string in the format "hh:mm:ss"
    // Hourse should not be shown if the time is less than 1 hour
    // Same for minutes
    // If one of the number is less than 10, it should have a leading zero

    let hours = Math.floor(seconds / 3600);
    let minutes = Math.floor((seconds - hours * 3600) / 60);
    let secondsLeft = seconds - hours * 3600 - minutes * 60;

    let hoursString = hours > 0 ? `${hours}:` : "";
    let minutesString = minutes > 0 ? `${minutes}:` : "";
    let secondsString = secondsLeft > 0 ? `${secondsLeft}` : "";

    if (hoursString.length > 0 && minutesString.length === 0) {
        minutesString = "00:";
    }

    if (minutesString.length > 0 && secondsString.length === 0) {
        secondsString = "00";
    }

    if (hoursString.length > 0 && minutesString.length > 0 && secondsString.length === 1) {
        secondsString = `0${secondsString}`;
    }

    // If only seconds are shown, add "s" at the end
    if (hoursString.length === 0 && minutesString.length === 0) {
        secondsString += "s";
    }

    // If only minutes are shown, add "m" at the end
    if (hoursString.length === 0 && minutesString.length > 0) {
        secondsString += "m";
    }

    return `${hoursString}${minutesString}${secondsString}`;
}

module.exports = {
    getTimeString,
};
