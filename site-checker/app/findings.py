import re
from dataclasses import dataclass

SEVERITIES = ("high", "medium", "low")
GROUPS = ("findability", "security", "speed", "measurement")

# Findings that suggest patching the site isn't sensible. The report only ever says
# "we'd recommend a rebuild"; a human makes the actual call.
REBUILD_IDS = {"no_https", "eol_software"}


def clean(text, limit: int = 200) -> str:
    """Site-derived text (evidence) is untrusted: strip control chars, collapse space, truncate."""
    s = re.sub(r"[\x00-\x1f\x7f]", " ", str(text))
    s = re.sub(r"\s+", " ", s).strip()
    return s[:limit]


@dataclass
class Finding:
    id: str
    group: str
    severity: str
    title: str
    detail: str
    evidence: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "group": self.group,
            "severity": self.severity,
            "title": self.title,
            "detail": self.detail,
            "evidence": clean(self.evidence),
        }
