"""Small robots.txt parser - just enough to answer three questions:

1. Does the site ask our own checker (a specific `TelaLoomSiteCheck` group) not to visit?
2. Does a crawler token (e.g. GPTBot) - or the wildcard group - disallow the whole site?
3. Which sitemaps does it declare?
"""
import re

_LINE_RE = re.compile(r"^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$")


def _groups(text: str):
    """Yield (agents, rules) where rules is a list of (directive, value)."""
    agents, rules, seen_rule = [], [], False
    for raw in (text or "").splitlines():
        line = raw.split("#", 1)[0]
        m = _LINE_RE.match(line)
        if not m:
            continue
        key, value = m.group(1).lower(), m.group(2)
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
    out = []
    for raw in (text or "").splitlines():
        m = _LINE_RE.match(raw.split("#", 1)[0])
        if m and m.group(1).lower() == "sitemap" and m.group(2):
            out.append(m.group(2))
    return out
