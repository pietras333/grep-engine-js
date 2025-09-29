function matchPattern(inputLine, pattern) {
    const hasStartAnchor = pattern.startsWith("^");
    const hasEndAnchor = pattern.endsWith("$");
    let actualPattern = pattern;

    if (hasStartAnchor) {
        actualPattern = pattern.slice(1);
    }
    if (hasEndAnchor) {
        actualPattern = actualPattern.slice(0, -1);
    }

    const result = tokenize(actualPattern);
    const tokens = result.tokens;

    if (hasEndAnchor && hasStartAnchor) {
        const captures = {};
        const endPosition = matchRecursive(inputLine, 0, tokens, 0, captures);
        return endPosition === inputLine.length;
    }

    if (hasEndAnchor) {
        for (let start = 0; start <= inputLine.length; start++) {
            const captures = {};
            const endPos = matchRecursive(inputLine, start, tokens, 0, captures);
            if (endPos === inputLine.length) {
                return true;
            }
        }
        return false;
    }

    if (hasStartAnchor) {
        const captures = {};
        const endPos = matchRecursive(inputLine, 0, tokens, 0, captures);
        return endPos !== -1;
    }

    for (let i = 0; i <= inputLine.length; i++) {
        const captures = {};
        const endPos = matchRecursive(inputLine, i, tokens, 0, captures);
        if (endPos !== -1) {
            return true;
        }
    }

    return false;
}

const tokenize = (pattern, captureGroupCount = 0) => {
    const tokens = []

    for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];

        if (char === "(") {
            // Find matching closing parenthesis
            let depth = 1;
            let j = i + 1;
            while (j < pattern.length && depth > 0) {
                if (pattern[j] === "(" && (j === 0 || pattern[j - 1] !== "\\")) depth++;
                if (pattern[j] === ")" && (j === 0 || pattern[j - 1] !== "\\")) depth--;
                j++;
            }

            if (depth === 0) {
                captureGroupCount++;
                const groupNumber = captureGroupCount;
                const groupContent = pattern.slice(i + 1, j - 1);

                // Tokenize alternatives, passing through the current capture count
                const alternatives = [];
                const parts = splitAlternatives(groupContent);

                for (const alt of parts) {
                    const result = tokenize(alt, captureGroupCount);
                    alternatives.push(result.tokens);
                    captureGroupCount = result.captureGroupCount;
                }

                const token = { type: "group", alternatives, captureGroup: groupNumber };
                i = j - 1;

                if (i + 1 < pattern.length && pattern[i + 1] === "+") {
                    tokens.push({ token, quantifier: "+" })
                    i++;
                } else if (i + 1 < pattern.length && pattern[i + 1] === "?") {
                    tokens.push({ token, quantifier: "?" })
                    i++;
                } else {
                    tokens.push({ token, quantifier: null })
                }
            } else {
                tokens.push({ token: char, quantifier: null });
            }
        } else if (char === "\\" && i < pattern.length - 1) {
            const nextChar = pattern[i + 1];

            // Check if it's a backreference
            if (nextChar >= "1" && nextChar <= "9") {
                const backreferenceNum = parseInt(nextChar);
                tokens.push({ token: { type: "backreference", number: backreferenceNum }, quantifier: null });
                i++;
            } else {
                const token = "\\" + nextChar;
                i++;

                if (i + 1 < pattern.length && pattern[i + 1] === "+") {
                    tokens.push({ token, quantifier: "+" })
                    i++;
                } else if (i + 1 < pattern.length && pattern[i + 1] === "?") {
                    tokens.push({ token, quantifier: "?" })
                    i++;
                } else {
                    tokens.push({ token, quantifier: null })
                }
            }
        } else if (char === "[") {
            let j = i + 1;
            while (j < pattern.length && pattern[j] !== "]") {
                j++;
            }
            if (j < pattern.length) {
                const token = pattern.slice(i, j + 1);
                i = j;

                if (i + 1 < pattern.length && pattern[i + 1] === "+") {
                    tokens.push({ token, quantifier: "+" })
                    i++;
                } else if (i + 1 < pattern.length && pattern[i + 1] === "?") {
                    tokens.push({ token, quantifier: "?" })
                    i++;
                } else {
                    tokens.push({ token, quantifier: null })
                }
            } else {
                tokens.push({ token: char, quantifier: null });
            }
        } else {
            if (i + 1 < pattern.length && pattern[i + 1] === "+") {
                tokens.push({ token: char, quantifier: "+" })
                i++;
            } else if (i + 1 < pattern.length && pattern[i + 1] === "?") {
                tokens.push({ token: char, quantifier: "?" })
                i++;
            } else {
                tokens.push({ token: char, quantifier: null })
            }
        }
    }
    return { tokens, captureGroupCount };
}

// Split alternatives at top level only (not within nested groups)
function splitAlternatives(pattern) {
    const parts = [];
    let current = "";
    let depth = 0;

    for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];

        if (char === "(" && (i === 0 || pattern[i - 1] !== "\\")) {
            depth++;
            current += char;
        } else if (char === ")" && (i === 0 || pattern[i - 1] !== "\\")) {
            depth--;
            current += char;
        } else if (char === "|" && depth === 0) {
            parts.push(current);
            current = "";
        } else {
            current += char;
        }
    }

    parts.push(current);
    return parts;
}

const matchToken = (input, token) => {
    if (token === ".") return true;
    if (token === "\\s") return (input === " " || input === "\n" || input === "\t");
    if (token === "\\d") return input >= "0" && input <= "9";
    if (token === "\\w") return (input >= "0" && input <= "9") ||
        (input >= "a" && input <= "z") ||
        (input >= "A" && input <= "Z") || input === "_";

    // Character classes [ ... ]
    if (token.startsWith("[") && token.endsWith("]")) {
        const content = token.slice(1, -1);
        let negate = false;
        let chars = [];

        if (content.startsWith("^")) {
            negate = true;
        }

        for (let i = negate ? 1 : 0; i < content.length; i++) {
            if (i + 2 < content.length && content[i + 1] === "-") {
                const start = content.charCodeAt(i);
                const end = content.charCodeAt(i + 2);
                for (let c = start; c <= end; c++) {
                    chars.push(String.fromCharCode(c));
                }
                i += 2;
            } else {
                chars.push(content[i]);
            }
        }

        const match = chars.includes(input);
        return negate ? !match : match;
    }

    // Escape sequences like \. or \(
    if (token.length === 2 && token[0] === "\\") {
        return input === token[1];
    }

    return input === token;
};


const matchRecursive = (inputLine, inputPosition, tokens, tokenIndex, captures) => {
    if (tokenIndex === tokens.length) {
        return inputPosition;
    }
    const { token, quantifier } = tokens[tokenIndex];

    // Handle backreferences
    if (typeof token === "object" && token.type === "backreference") {
        const capturedText = captures[token.number];
        if (capturedText === undefined) return -1;

        if (inputPosition + capturedText.length > inputLine.length) return -1;

        for (let i = 0; i < capturedText.length; i++) {
            if (inputLine[inputPosition + i] !== capturedText[i]) return -1;
        }

        return matchRecursive(
            inputLine,
            inputPosition + capturedText.length,
            tokens,
            tokenIndex + 1,
            captures
        );
    }

    // Handle groups with alternation
    if (typeof token === "object" && token.type === "group") {
        if (quantifier === "?") {
            // Try matching the group
            for (const alternative of token.alternatives) {
                const capturesCopy = { ...captures };
                const endPos = matchRecursive(inputLine, inputPosition, alternative, 0, capturesCopy);
                if (endPos !== -1) {
                    if (token.captureGroup) {
                        capturesCopy[token.captureGroup] = inputLine.slice(inputPosition, endPos);
                    }
                    const result = matchRecursive(inputLine, endPos, tokens, tokenIndex + 1, capturesCopy);
                    if (result !== -1) {
                        Object.assign(captures, capturesCopy);
                        return result;
                    }
                }
            }
            // Try skipping the group
            return matchRecursive(inputLine, inputPosition, tokens, tokenIndex + 1, captures);
        } else if (quantifier === "+") {
            // Must match at least once
            let matchedOnce = false;
            let positions = [];
            let currentPos = inputPosition;

            while (true) {
                let foundMatch = false;
                for (const alternative of token.alternatives) {
                    const capturesCopy = { ...captures };
                    const endPos = matchRecursive(inputLine, currentPos, alternative, 0, capturesCopy);
                    if (endPos !== -1 && endPos > currentPos) {
                        matchedOnce = true;
                        positions.push({ pos: endPos, captures: capturesCopy });
                        currentPos = endPos;
                        foundMatch = true;
                        break;
                    }
                }
                if (!foundMatch) break;
            }

            if (!matchedOnce) return -1;

            // Try from longest match to shortest
            for (let i = positions.length - 1; i >= 0; i--) {
                const capturesCopy = { ...positions[i].captures };
                if (token.captureGroup) {
                    capturesCopy[token.captureGroup] = inputLine.slice(inputPosition, positions[i].pos);
                }
                const result = matchRecursive(inputLine, positions[i].pos, tokens, tokenIndex + 1, capturesCopy);
                if (result !== -1) {
                    Object.assign(captures, capturesCopy);
                    return result;
                }
            }
            return -1;
        } else {
            // No quantifier - try each alternative
            for (const alternative of token.alternatives) {
                const capturesCopy = { ...captures };
                const endPos = matchRecursive(inputLine, inputPosition, alternative, 0, capturesCopy);
                if (endPos !== -1) {
                    if (token.captureGroup) {
                        capturesCopy[token.captureGroup] = inputLine.slice(inputPosition, endPos);
                    }
                    const result = matchRecursive(inputLine, endPos, tokens, tokenIndex + 1, capturesCopy);
                    if (result !== -1) {
                        Object.assign(captures, capturesCopy);
                        return result;
                    }
                }
            }
            return -1;
        }
    }

    if (quantifier === "?") {
        if (inputPosition < inputLine.length && matchToken(inputLine[inputPosition], token)) {
            const result = matchRecursive(inputLine, inputPosition + 1, tokens, tokenIndex + 1, captures);
            if (result !== -1) {
                return result;
            }
        }
        return matchRecursive(inputLine, inputPosition, tokens, tokenIndex + 1, captures);
    }

    if (quantifier === "+") {
        if (inputPosition >= inputLine.length || !matchToken(inputLine[inputPosition], token)) {
            return -1;
        }

        let maxMatch = inputPosition + 1;
        while (maxMatch < inputLine.length && matchToken(inputLine[maxMatch], token)) {
            maxMatch++;
        }

        for (let endPos = maxMatch; endPos > inputPosition; endPos--) {
            const result = matchRecursive(inputLine, endPos, tokens, tokenIndex + 1, captures);
            if (result !== -1) {
                return result;
            }
        }
        return -1;
    }

    if (inputPosition >= inputLine.length || !matchToken(inputLine[inputPosition], token)) {
        return -1;
    }
    return matchRecursive(inputLine, inputPosition + 1, tokens, tokenIndex + 1, captures);
}

function main() {
    const pattern = process.argv[3];
    const inputLine = require("fs").readFileSync(0, "utf-8").trim();

    if (process.argv[2] !== "-E") {
        console.log("Expected first argument to be '-E'");
        process.exit(1);
    }

    console.error("Logs from your program will appear here");

    if (matchPattern(inputLine, pattern)) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

main();
