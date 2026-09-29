from app import robots

BLOCK_ALL = "User-agent: *\nDisallow: /\n"
GPT_ONLY = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow:\n"
OURS = "User-agent: TelaLoomSiteCheck\nDisallow: /\n"
OPEN = "User-agent: *\nDisallow: /admin/\nSitemap: https://x.example/sitemap.xml\nsitemap: https://x.example/s2.xml # c\n"


def test_wildcard_block_detected():
    assert robots.blocks_all_for(BLOCK_ALL, "Googlebot") == "wildcard"
    assert robots.blocks_all_for(BLOCK_ALL, "GPTBot") == "wildcard"


def test_specific_group_beats_wildcard():
    assert robots.blocks_all_for(GPT_ONLY, "GPTBot") == "specific"
    assert robots.blocks_all_for(GPT_ONLY, "ClaudeBot") == ""
    assert robots.blocks_all_for(GPT_ONLY, "Googlebot") == ""


def test_specific_allow_overrides_wildcard_block():
    text = "User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /\n"
    assert robots.blocks_all_for(text, "GPTBot") == ""
    assert robots.blocks_all_for(text, "ClaudeBot") == "wildcard"


def test_partial_disallow_is_not_a_block():
    assert robots.blocks_all_for(OPEN, "GPTBot") == ""


def test_opt_out_only_for_our_named_group():
    assert robots.specific_group_blocks_all(OURS, "TelaLoomSiteCheck")
    assert not robots.specific_group_blocks_all(BLOCK_ALL, "TelaLoomSiteCheck")  # wildcard alone isn't an opt-out
    assert not robots.specific_group_blocks_all(OPEN, "TelaLoomSiteCheck")


def test_multiple_agents_share_a_group():
    text = "User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n"
    assert robots.blocks_all_for(text, "GPTBot") == "specific"
    assert robots.blocks_all_for(text, "ClaudeBot") == "specific"
    assert robots.blocks_all_for(text, "CCBot") == ""


def test_sitemaps_and_comments():
    assert robots.sitemaps(OPEN) == ["https://x.example/sitemap.xml", "https://x.example/s2.xml"]


def test_crafted_robots_txt_cannot_freeze_the_parser():
    # A backtracking regex was quadratic on this (~1e12 steps, holding the GIL for the whole process).
    import time
    evil = "a:x" + " " * 1_500_000 + "y\n"
    many = ("user-agent: *\n" + "disallow: " + "/a" * 490 + "\n") * 5000
    t0 = time.monotonic()
    assert robots.blocks_all_for(evil, "GPTBot") == ""
    assert robots.sitemaps(evil) == []
    robots.blocks_all_for(many, "GPTBot")
    robots.sitemaps(many)
    assert time.monotonic() - t0 < 1.0


def test_overlong_lines_and_line_count_are_bounded():
    long_line = "sitemap: https://x.example/" + "a" * 2000
    assert robots.sitemaps(long_line) == []
    lines = "\n".join(f"sitemap: https://x.example/{i}.xml" for i in range(100))
    assert len(robots.sitemaps(lines)) == 10
    hidden = "\n" * robots.MAX_LINES + "user-agent: *\ndisallow: /\n"
    assert robots.blocks_all_for(hidden, "GPTBot") == ""   # beyond the line cap, never read


def test_garbage_is_safe():
    assert robots.blocks_all_for("<html>404</html>\x00\xff", "GPTBot") == ""
    assert robots.sitemaps("") == []
    assert robots.blocks_all_for(None, "GPTBot") == ""
