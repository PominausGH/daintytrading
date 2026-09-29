"""Small robots.txt parser - just enough to answer three questions:

1. Does the site ask our own checker (a specific `TelaLoomSiteCheck` group) not to visit?
2. Does a crawler token (e.g. GPTBot) - or the wildcard group - disallow the whole site?
3. Which sitemaps does it declare?

robots.txt is attacker-controlled, so parsing is regex-free (str.partition/strip only - a backtracking
regex on a crafted line could freeze the whole checker process) and bounded: overlong lines are
ignored and only the first MAX_LINES lines are read.
"""

MAX_LINES = 5000
MAX_LINE_CHARS = 1000


def _directives(text: str):
    """Yield (key, value) for every well-formed, reasonably sized line."""
    for raw in (text or "").splitlines()[:MAX_LINES]:
        if len(raw) > MAX_LINE_CHARS:
            continue
        line = raw.split("#", 1)[0]
        key, sep, value = line.partition(":")
        if not sep:
            continue
        key = key.strip().lower()
        if key:
            yield key, value.strip()


def _groups(text: str):
    """Yield (agents, rules) where rules is a list of (directive, value)."""
    agents, rules, seen_rule = [], [], False
    for key, value in _directives(text):
        if key == "user-agent":
            if seen_rule:
                yield agents, rules
                agents, rules, seen_rule = [], [], False
            agents.append(value.lower())
        elif key in ("allow", "disallow"):
            seen_rule = True
            rules.append((key, value))
    if agents:
        yield agents, rules


def _blocks_root(rules) -> bool:
    disallow_root = any(k == "disallow" and v == "/" for k, v in rules)
    allow_root = any(k == "allow" and v in ("/", "/*") for k, v in rules)
    return disallow_root and not allow_root


def specific_group_blocks_all(text: str, token: str) -> bool:
    """True only if a group naming `token` explicitly disallows everything."""
    token = token.lower()
    for agents, rules in _groups(text):
        if any(token == a or (a != "*" and a in token) for a in agents) and _blocks_root(rules):
            return True
    return False


def blocks_all_for(text: str, token: str) -> str:
    """Return 'specific', 'wildcard' or '' - how (if at all) `token` is blocked from the whole site."""
    if specific_group_blocks_all(text, token):
        return "specific"
    token = token.lower()
    has_specific_group = False
    wildcard_blocks = False
    for agents, rules in _groups(text):
        if any(token == a or (a != "*" and a in token) for a in agents):
            has_specific_group = True
        if "*" in agents and _blocks_root(rules):
            wildcard_blocks = True
    if wildcard_blocks and not has_specific_group:
        return "wildcard"
    return ""


def sitemaps(text: str) -> list:
    return [value for key, value in _directives(text) if key == "sitemap" and value][:10]
