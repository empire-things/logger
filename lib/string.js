function sanitize(str) {
    if (!str) return "";
    return str
        .replace(/&145;/g, "'")
        .replace(/&percnt;/g, "%")
        .replace(/&quot;/g, '"')
        .replace(/%5C/g, "\\");
}

// Export using CommonJS syntax

module.exports = {
    sanitize,
};
